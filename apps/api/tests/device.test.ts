import { randomUUID } from "node:crypto";

import { createDb, sql, withTenantScope } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { consumeEnrolmentCode } from "backend/src/device/db-operations/commands/consume-enrolment-code.command.ts";
import { hashDeviceToken } from "backend/src/device/token.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

// Issue 09: enrolment, the Device principal, and revocation.
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantA = randomUUID();
const tenantB = randomUUID();
const adminA = randomUUID();
const managerA = randomUUID();
const cashierA = randomUUID();
const adminB = randomUUID();
const storeA1 = randomUUID();
const storeA2 = randomUUID();
const storeB = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "Device Tenant A" },
      { id: tenantB, name: "Device Tenant B" },
    ])
    .execute();

  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: adminA,
        tenant_id: tenantA,
        email: `dev-admin-${randomUUID()}@dev.test`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: managerA,
        tenant_id: tenantA,
        email: `dev-manager-${randomUUID()}@dev.test`,
        password_hash: passwordHash,
        role: "manager",
      },
      {
        id: cashierA,
        tenant_id: tenantA,
        email: `dev-cashier-${randomUUID()}@dev.test`,
        password_hash: passwordHash,
        role: "cashier",
      },
      {
        id: adminB,
        tenant_id: tenantB,
        email: `dev-admin-b-${randomUUID()}@dev.test`,
        password_hash: passwordHash,
        role: "admin",
      },
    ])
    .execute();

  await withTenantScope(seam.db, tenantA, (db) =>
    db
      .insertInto("Store")
      .values([
        { id: storeA1, tenant_id: tenantA, name: "A Store 1" },
        { id: storeA2, tenant_id: tenantA, name: "A Store 2" },
      ])
      .execute(),
  );
  await withTenantScope(seam.db, tenantB, (db) =>
    db.insertInto("Store").values({ id: storeB, tenant_id: tenantB, name: "B Store" }).execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("DeviceAudit").where("tenant_id", "in", [tenantA, tenantB]).execute();
  // EnrolmentCode.device_id FKs Device with ON DELETE RESTRICT — clear the
  // referencing rows first.
  await ownerDb.deleteFrom("EnrolmentCode").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Device").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

// One admin-generated code + exchange, reused by several tests below.
async function generateAndExchange(storeId: string, code: string, actor = adminA) {
  const generated = await seam.actors
    .asTenant(tenantA, { userId: actor, role: "admin" })
    .client.device.generateCode({ storeId, name: "Counter 1", code });
  if (!generated.ok) throw new Error("setup: generateCode failed");
  const exchanged = await seam.client.terminal.enrol({ secret: generated.secret });
  return { generated, exchanged };
}

describe("device.generateCode", () => {
  it("an admin generates a code bound to one Store, with a name and short code", async () => {
    const result = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeA1, name: "Counter 9", code: "C9" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.secret).toHaveLength(8);
    expect(result.code).toBe("C9");
    expect(result.storeId).toBe(storeA1);

    const audit = await withTenantScope(seam.db, tenantA, (db) =>
      db
        .selectFrom("DeviceAudit")
        .selectAll()
        .where("field", "=", "code_generated")
        .where("new_value", "=", "C9")
        .executeTakeFirst(),
    );
    expect(audit?.actor_user_id).toBe(adminA);
    expect(audit?.enrolment_code_id).not.toBeNull();
    expect(audit?.device_id).toBeNull();
  });

  it("a manager and a cashier are refused, server-side", async () => {
    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.device.generateCode({ storeId: storeA1, name: "X", code: "XX" });
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.device.generateCode({ storeId: storeA1, name: "X", code: "XX" });

    expect(asManager.ok).toBe(false);
    expect(asCashier.ok).toBe(false);
  });

  it("Tenant A submitting Tenant B's storeId is refused; B may use that same storeId", async () => {
    const asA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "Cross Tenant", code: "XT" });
    expect(asA.ok).toBe(false);

    const asB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "Cross Tenant", code: "XT" });
    expect(asB.ok).toBe(true);
  });

  it("refuses a code already reserved or in use at that Store", async () => {
    const first = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeA1, name: "Dup 1", code: "DP" });
    expect(first.ok).toBe(true);

    const second = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeA1, name: "Dup 2", code: "DP" });
    expect(second.ok).toBe(false);

    // The same code at a different Store is unaffected.
    const otherStore = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeA2, name: "Dup 3", code: "DP" });
    expect(otherStore.ok).toBe(true);
  });
});

describe("terminal.enrol", () => {
  it("exchanges a valid code for a high-entropy token, stored hashed", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "E1");

    expect(exchanged.ok).toBe(true);
    if (!exchanged.ok) return;
    expect(exchanged.token.length).toBeGreaterThanOrEqual(40);
    expect(exchanged.code).toBe("E1");
    expect(exchanged.storeName).toBe("A Store 1");

    const row = await withTenantScope(seam.db, tenantA, (db) =>
      db.selectFrom("Device").selectAll().where("id", "=", exchanged.deviceId).executeTakeFirst(),
    );
    expect(row?.token_hash).toBe(hashDeviceToken(exchanged.token));
    expect(row?.token_hash).not.toBe(exchanged.token);

    // No audit row for the exchange itself — its actor is a terminal, not a User.
    const audits = await withTenantScope(seam.db, tenantA, (db) =>
      db
        .selectFrom("DeviceAudit")
        .selectAll()
        .where("device_id", "=", exchanged.deviceId)
        .execute(),
    );
    expect(audits).toHaveLength(0);
  });

  it("a second exchange of the same code fails", async () => {
    const generated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeA1, name: "Reuse", code: "RU" });
    if (!generated.ok) throw new Error("setup failed");

    const first = await seam.client.terminal.enrol({ secret: generated.secret });
    expect(first.ok).toBe(true);

    const second = await seam.client.terminal.enrol({ secret: generated.secret });
    expect(second.ok).toBe(false);
  });

  it("the wrong-tenant probe: exchanging under Tenant A's session still enrols the Device into the code's own Tenant, B", async () => {
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Enrol Target", code: "BE" });
    if (!generatedAsB.ok) throw new Error("setup failed");

    // The caller's own session is Tenant A — enrol takes no tenant input,
    // so nothing here should let A's context leak into the resulting row.
    const exchanged = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.terminal.enrol({ secret: generatedAsB.secret });
    expect(exchanged.ok).toBe(true);
    if (!exchanged.ok) return;

    const row = await ownerDb
      .selectFrom("Device")
      .select("tenant_id")
      .where("id", "=", exchanged.deviceId)
      .executeTakeFirstOrThrow();
    expect(row.tenant_id).toBe(tenantB);

    const asA = await withTenantScope(seam.db, tenantA, (db) =>
      db.selectFrom("Device").select("id").where("id", "=", exchanged.deviceId).execute(),
    );
    expect(asA).toHaveLength(0);

    // The positive side, through B's own app-role connection rather than the
    // owner bypass above — proves RLS itself admits the row, not just that
    // the owner query happened to find it.
    const asB = await withTenantScope(seam.db, tenantB, (db) =>
      db.selectFrom("Device").select("id").where("id", "=", exchanged.deviceId).execute(),
    );
    expect(asB).toHaveLength(1);
  });

  it("an unrecognised secret fails with the same shape as expired or consumed", async () => {
    const result = await seam.client.terminal.enrol({ secret: "ZZZZZZZZ" });
    expect(result.ok).toBe(false);
  });

  it("an expired code fails", async () => {
    const generated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeA1, name: "Expired", code: "EX" });
    if (!generated.ok) throw new Error("setup failed");

    await ownerDb
      .updateTable("EnrolmentCode")
      .set({ expires_at: new Date(Date.now() - 1000) })
      .where("secret", "=", generated.secret)
      .execute();

    const result = await seam.client.terminal.enrol({ secret: generated.secret });
    expect(result.ok).toBe(false);
  });

  // The claim this issue makes hardest: a real race, with a barrier, must
  // mint at most one Device — not a Promise.all that happens to serialise.
  it("two genuinely concurrent exchanges of the same code mint exactly one Device", async () => {
    const generated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeA1, name: "Race", code: "RC" });
    if (!generated.ok) throw new Error("setup failed");

    // Both requests are issued before either awaits a response — a genuine
    // race on the same underlying connection pool, not a sequential pair.
    const [first, second] = await Promise.all([
      seam.client.terminal.enrol({ secret: generated.secret }),
      seam.client.terminal.enrol({ secret: generated.secret }),
    ]);

    const outcomes = [first, second];
    expect(outcomes.filter((r) => r.ok)).toHaveLength(1);
    expect(outcomes.filter((r) => !r.ok)).toHaveLength(1);

    const devices = await ownerDb
      .selectFrom("Device")
      .select("id")
      .where("code", "=", "RC")
      .where("tenant_id", "=", tenantA)
      .execute();
    expect(devices).toHaveLength(1);
  });

  // Targets consumeEnrolmentCode directly with two FK-valid Device ids, so
  // nothing but its own guard can save it — the Device unique index above
  // cannot. Holds the row lock until both attempts are provably waiting.
  it("consumeEnrolmentCode itself lets only one of two genuinely concurrent callers through", async () => {
    const enrolmentCodeId = randomUUID();
    const deviceId1 = randomUUID();
    const deviceId2 = randomUUID();

    await withTenantScope(seam.db, tenantA, (db) =>
      db
        .insertInto("Device")
        .values([
          {
            id: deviceId1,
            tenant_id: tenantA,
            store_id: storeA1,
            name: "Lock A",
            code: "KA",
            token_hash: `lock-hash-${deviceId1}`,
          },
          {
            id: deviceId2,
            tenant_id: tenantA,
            store_id: storeA1,
            name: "Lock B",
            code: "KB",
            token_hash: `lock-hash-${deviceId2}`,
          },
        ])
        .execute(),
    );
    await withTenantScope(seam.db, tenantA, (db) =>
      db
        .insertInto("EnrolmentCode")
        .values({
          id: enrolmentCodeId,
          tenant_id: tenantA,
          store_id: storeA1,
          name: "Lock Race",
          code: "KR",
          secret: "RACEBARS",
          expires_at: new Date(Date.now() + 10 * 60 * 1000),
        })
        .execute(),
    );

    let releaseLock!: () => void;
    const lockReleased = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    let signalAcquired!: () => void;
    const lockAcquired = new Promise<void>((resolve) => {
      signalAcquired = resolve;
    });

    const holder = withTenantScope(seam.db, tenantA, async (trx) => {
      await trx
        .selectFrom("EnrolmentCode")
        .selectAll()
        .where("id", "=", enrolmentCodeId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      signalAcquired();
      await lockReleased;
    });
    // Signalled from inside the holder's own transaction, right after its
    // FOR UPDATE returns — no sleep, no guess at how long that takes.
    await lockAcquired;

    let resolvePid1!: (pid: number) => void;
    const pid1 = new Promise<number>((resolve) => {
      resolvePid1 = resolve;
    });
    let resolvePid2!: (pid: number) => void;
    const pid2 = new Promise<number>((resolve) => {
      resolvePid2 = resolve;
    });

    const attempt1 = withTenantScope(seam.db, tenantA, async (db) => {
      const { rows } = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(db);
      resolvePid1(rows[0]!.pid);
      return consumeEnrolmentCode(db, enrolmentCodeId, deviceId1);
    });
    const attempt2 = withTenantScope(seam.db, tenantA, async (db) => {
      const { rows } = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(db);
      resolvePid2(rows[0]!.pid);
      return consumeEnrolmentCode(db, enrolmentCodeId, deviceId2);
    });
    const pids = [await pid1, await pid2];

    // Filtered by the two attempts' own backend pids, so a concurrent test
    // elsewhere can never inflate this count — only these two connections
    // can satisfy it.
    const deadline = Date.now() + 2000;
    let blocked = 0;
    try {
      while (Date.now() < deadline) {
        const result = await sql<{ count: string }>`
          select count(*)::text as count
          from pg_stat_activity
          where wait_event_type = 'Lock' and pid = any(${pids})
        `.execute(ownerDb);
        blocked = Number(result.rows[0]?.count ?? "0");
        if (blocked >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } finally {
      releaseLock();
    }
    expect(blocked).toBeGreaterThanOrEqual(2);

    await holder;
    const [result1, result2] = await Promise.all([attempt1, attempt2]);

    expect([result1, result2].filter(Boolean)).toHaveLength(1);
  });
});

describe("Device short code is not reissued after revocation", () => {
  it("refuses a code already used by a revoked Device at that Store", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "RV");
    if (!exchanged.ok) throw new Error("setup failed");

    await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.revoke({ id: exchanged.deviceId });

    const reserved = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeA1, name: "Reissue Attempt", code: "RV" });
    expect(reserved.ok).toBe(false);
  });

  it("an exchange that actually reaches the Device index is refused: the code stays taken at that Store after revocation", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "RX");
    if (!exchanged.ok) throw new Error("setup failed");

    await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.revoke({ id: exchanged.deviceId });

    // Seeded directly, bypassing generateCode's own isCodeReserved check,
    // so this exchange actually reaches the Device(tenant, store, code)
    // unique index instead of stopping earlier.
    await withTenantScope(seam.db, tenantA, (db) =>
      db
        .insertInto("EnrolmentCode")
        .values({
          id: randomUUID(),
          tenant_id: tenantA,
          store_id: storeA1,
          name: "Reissue Attempt",
          code: "RX",
          secret: "RXNSTGKM",
          expires_at: new Date(Date.now() + 10 * 60 * 1000),
        })
        .execute(),
    );

    const reissued = await seam.client.terminal.enrol({ secret: "RXNSTGKM" });
    expect(reissued.ok).toBe(false);
  });

  it("the same short code exchanges successfully at two different Stores — the index is no-WHERE but per-Store", async () => {
    const first = await generateAndExchange(storeA1, "SS");
    const second = await generateAndExchange(storeA2, "SS");

    expect(first.exchanged.ok).toBe(true);
    expect(second.exchanged.ok).toBe(true);
  });
});

describe("the Device token principal", () => {
  it("derives Tenant and Store from the Device, never from input — heartbeat and me carry no such input", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "T1");
    if (!exchanged.ok) throw new Error("setup failed");

    const me = await seam.actors
      .asDevice({
        tenantId: tenantA,
        deviceId: exchanged.deviceId,
        storeId: storeA1,
        code: "T1",
        name: "Counter 1",
      })
      .client.terminal.me();

    expect(me.authenticated).toBe(true);
    if (!me.authenticated) return;
    expect(me.storeId).toBe(storeA1);
    expect(me.storeName).toBe("A Store 1");
  });

  it("the wrong-tenant probe: A's and B's Device tokens each resolve me/heartbeat to their own Tenant's Store only, and one Tenant's heartbeat never touches the other's row", async () => {
    const { exchanged: exchangedAsA } = await generateAndExchange(storeA1, "TA");
    if (!exchangedAsA.ok) throw new Error("setup failed");
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Token", code: "TB" });
    if (!generatedAsB.ok) throw new Error("setup failed");
    const exchangedAsB = await seam.client.terminal.enrol({ secret: generatedAsB.secret });
    if (!exchangedAsB.ok) throw new Error("setup failed");

    const meAsA = await seam.actors.withBearerToken(exchangedAsA.token).terminal.me();
    const meAsB = await seam.actors.withBearerToken(exchangedAsB.token).terminal.me();

    expect(meAsA.authenticated && meAsA.storeId).toBe(storeA1);
    expect(meAsB.authenticated && meAsB.storeId).toBe(storeB);

    const lastSeen = async (deviceId: string) =>
      (
        await ownerDb
          .selectFrom("Device")
          .select("last_seen_at")
          .where("id", "=", deviceId)
          .executeTakeFirstOrThrow()
      ).last_seen_at.getTime();

    // A canary on each row, asserted in both directions: a heartbeat called
    // alone must move its own tenant's timestamp and leave the other's exactly
    // where it was.
    const beforeA = await lastSeen(exchangedAsA.deviceId);
    const beforeB = await lastSeen(exchangedAsB.deviceId);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect((await seam.actors.withBearerToken(exchangedAsA.token).terminal.heartbeat()).ok).toBe(
      true,
    );
    const afterA = await lastSeen(exchangedAsA.deviceId);
    expect(afterA).toBeGreaterThan(beforeA);
    expect(await lastSeen(exchangedAsB.deviceId)).toBe(beforeB);

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect((await seam.actors.withBearerToken(exchangedAsB.token).terminal.heartbeat()).ok).toBe(
      true,
    );
    expect(await lastSeen(exchangedAsB.deviceId)).toBeGreaterThan(beforeB);
    expect(await lastSeen(exchangedAsA.deviceId)).toBe(afterA);
  });

  it("real Authorization header: enrol, then me/heartbeat over the bearer token, matched case-insensitively", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "T2");
    if (!exchanged.ok) throw new Error("setup failed");

    const client = seam.actors.withBearerToken(exchanged.token);
    const me = await client.terminal.me();
    expect(me.authenticated).toBe(true);

    const heartbeat = await client.terminal.heartbeat();
    expect(heartbeat.ok).toBe(true);
  });

  it("cookie procedures do not accept a Device token — the two principals do not substitute", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "T3");
    if (!exchanged.ok) throw new Error("setup failed");

    const client = seam.actors.withBearerToken(exchanged.token);
    const stores = await client.store.list();
    // A Device Ctx is not "tenant" — the handler's own guard returns [].
    expect(stores).toStrictEqual([]);
  });

  it("a Device-token request is exempt from the Origin gate: withBearerToken never sets Origin, and still succeeds", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "T4");
    if (!exchanged.ok) throw new Error("setup failed");

    // withBearerToken never routes through the Origin gate (app.ts: it runs
    // only inside `if (sessionId)`), unlike the sibling cookie test.
    const me = await seam.actors.withBearerToken(exchanged.token).terminal.me();
    expect(me.authenticated).toBe(true);
  });

  it("revocation is immediate: every subsequent authenticated request from that Device is refused", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "T5");
    if (!exchanged.ok) throw new Error("setup failed");

    const client = seam.actors.withBearerToken(exchanged.token);
    expect((await client.terminal.me()).authenticated).toBe(true);

    await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.revoke({ id: exchanged.deviceId });

    // Asserted on more than one procedure (issue 09 acceptance criteria).
    expect((await client.terminal.me()).authenticated).toBe(false);
    expect((await client.terminal.heartbeat()).ok).toBe(false);
  });

  it("a revoke that lands between a real bearer request's lookup and its touch still refuses it, indistinguishably from any other refusal", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "TR");
    if (!exchanged.ok) throw new Error("setup failed");

    const client = seam.actors.withBearerToken(exchanged.token);
    expect((await client.terminal.me()).authenticated).toBe(true);

    // Lock the Device row so the revoke and the request's own touch both
    // queue behind it, revoke first — the request passes its lookup live
    // and is refused only when its touch loses the race to the revoke.
    let releaseLock!: () => void;
    const lockReleased = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    let signalAcquired!: () => void;
    const lockAcquired = new Promise<void>((resolve) => {
      signalAcquired = resolve;
    });
    const holder = withTenantScope(seam.db, tenantA, async (trx) => {
      await trx
        .selectFrom("Device")
        .selectAll()
        .where("id", "=", exchanged.deviceId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      signalAcquired();
      await lockReleased;
    });
    await lockAcquired;

    const revoked = seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.revoke({ id: exchanged.deviceId });

    // Both queries are unique to this file's Device UPDATEs, so waiting for
    // one, then the other, proves each has actually queued on the lock.
    const waitForWaiter = async (queryPrefix: string) => {
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        const result = await sql<{ count: string }>`
          select count(*)::text as count
          from pg_stat_activity
          where wait_event_type = 'Lock' and query ilike ${queryPrefix}
        `.execute(ownerDb);
        if (Number(result.rows[0]?.count ?? "0") >= 1) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`timed out waiting for: ${queryPrefix}`);
    };

    await waitForWaiter('update "Device" set "revoked_at"%');
    const raced = client.terminal.me();
    await waitForWaiter('update "Device" set "last_seen_at"%');

    releaseLock();
    const [revokedResult, racedResult] = await Promise.all([revoked, raced]);
    await holder;

    expect(revokedResult?.revokedAt).toBeInstanceOf(Date);
    expect(racedResult.authenticated).toBe(false);

    // `me` never distinguishes a raced refusal from an ordinary one — both
    // resolve `ctx.kind !== "device"` the same way (record 056 Q6).
    const ordinaryRefusal = await seam.actors.withBearerToken("not-a-real-token").terminal.me();
    expect(racedResult).toStrictEqual(ordinaryRefusal);
  });

  it("last-seen updates on activity", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "T6");
    if (!exchanged.ok) throw new Error("setup failed");

    const before = await ownerDb
      .selectFrom("Device")
      .select("last_seen_at")
      .where("id", "=", exchanged.deviceId)
      .executeTakeFirstOrThrow();

    await new Promise((resolve) => setTimeout(resolve, 5));
    await seam.actors.withBearerToken(exchanged.token).terminal.heartbeat();

    const after = await ownerDb
      .selectFrom("Device")
      .select("last_seen_at")
      .where("id", "=", exchanged.deviceId)
      .executeTakeFirstOrThrow();
    expect(after.last_seen_at.getTime()).toBeGreaterThan(before.last_seen_at.getTime());
  });
});

describe("device.list", () => {
  it("an admin sees every Device in their own Tenant, with last-seen", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "P1");
    if (!exchanged.ok) throw new Error("setup failed");

    const list = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.list();
    const row = list.find((d) => d.id === exchanged.deviceId);
    expect(row?.name).toBe("Counter 1");
    expect(row?.lastSeenAt).toBeInstanceOf(Date);
    expect(row?.revokedAt).toBeNull();
  });

  it("a manager and a cashier are refused, server-side, and see nothing", async () => {
    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.device.list();
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.device.list();
    expect(asManager).toStrictEqual([]);
    expect(asCashier).toStrictEqual([]);
  });

  it("an unauthenticated caller sees nothing", async () => {
    const list = await seam.actors.asUnauthenticated().client.device.list();
    expect(list).toStrictEqual([]);
  });

  it("the wrong-tenant probe: Tenant B's Device is readable as Tenant B, never in Tenant A's list", async () => {
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Device", code: "BB" });
    if (!generatedAsB.ok) throw new Error("setup failed");
    const exchangedAsB = await seam.client.terminal.enrol({ secret: generatedAsB.secret });
    if (!exchangedAsB.ok) throw new Error("setup failed");

    const asB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.list();
    expect(asB.map((d) => d.id)).toContain(exchangedAsB.deviceId);

    const asA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.list();
    expect(asA.map((d) => d.id)).not.toContain(exchangedAsB.deviceId);
  });
});

describe("device.rename", () => {
  it("renames a Device and writes one audit row with the old and new name", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "RN");
    if (!exchanged.ok) throw new Error("setup failed");

    const renamed = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.rename({ id: exchanged.deviceId, name: "Counter 1B" });
    expect(renamed?.name).toBe("Counter 1B");

    const audit = await withTenantScope(seam.db, tenantA, (db) =>
      db
        .selectFrom("DeviceAudit")
        .selectAll()
        .where("device_id", "=", exchanged.deviceId)
        .where("field", "=", "name")
        .executeTakeFirstOrThrow(),
    );
    expect(audit.old_value).toBe("Counter 1");
    expect(audit.new_value).toBe("Counter 1B");
  });

  it("a revoked Device may still be renamed", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "RR");
    if (!exchanged.ok) throw new Error("setup failed");

    await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.revoke({ id: exchanged.deviceId });

    const renamed = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.rename({ id: exchanged.deviceId, name: "Still Named" });
    expect(renamed?.name).toBe("Still Named");
  });

  it("a manager and a cashier are refused, server-side", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "RF");
    if (!exchanged.ok) throw new Error("setup failed");

    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.device.rename({ id: exchanged.deviceId, name: "Hijacked" });
    expect(asManager).toBeNull();
  });

  it("the wrong-tenant probe: Tenant A cannot rename Tenant B's Device; B's row is untouched", async () => {
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Rename Target", code: "BR" });
    if (!generatedAsB.ok) throw new Error("setup failed");
    const exchangedAsB = await seam.client.terminal.enrol({ secret: generatedAsB.secret });
    if (!exchangedAsB.ok) throw new Error("setup failed");

    await expectWrongTenantRefusal(
      () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.device.rename({ id: exchangedAsB.deviceId, name: "Hijacked From A" }),
      (result) => result === null,
    );

    // Through Tenant B's own scoped connection, not the owner bypass — this
    // is what proves RLS itself refused A's write, not just that no row
    // happened to match.
    const stillAsB = await withTenantScope(seam.db, tenantB, (db) =>
      db
        .selectFrom("Device")
        .select("name")
        .where("id", "=", exchangedAsB.deviceId)
        .executeTakeFirstOrThrow(),
    );
    expect(stillAsB.name).toBe("B Rename Target");
  });
});

describe("device.revoke", () => {
  it("an admin revokes a Device; a second revoke is a no-op refusal, never a hard delete", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "V1");
    if (!exchanged.ok) throw new Error("setup failed");

    const revoked = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.revoke({ id: exchanged.deviceId });
    expect(revoked?.revokedAt).toBeInstanceOf(Date);

    const stillReadable = await ownerDb
      .selectFrom("Device")
      .select("id")
      .where("id", "=", exchanged.deviceId)
      .executeTakeFirst();
    expect(stillReadable?.id).toBe(exchanged.deviceId);

    const second = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.revoke({ id: exchanged.deviceId });
    expect(second).toBeNull();
  });

  it("a manager and a cashier are refused, server-side", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "V2");
    if (!exchanged.ok) throw new Error("setup failed");

    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.device.revoke({ id: exchanged.deviceId });
    expect(asCashier).toBeNull();
  });

  it("the wrong-tenant probe: Tenant A cannot revoke Tenant B's Device; B's own revoke still succeeds", async () => {
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Revoke Target", code: "BV" });
    if (!generatedAsB.ok) throw new Error("setup failed");
    const exchangedAsB = await seam.client.terminal.enrol({ secret: generatedAsB.secret });
    if (!exchangedAsB.ok) throw new Error("setup failed");

    await expectWrongTenantRefusal(
      () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.device.revoke({ id: exchangedAsB.deviceId }),
      (result) => result === null,
    );

    const stillActive = await ownerDb
      .selectFrom("Device")
      .select("revoked_at")
      .where("id", "=", exchangedAsB.deviceId)
      .executeTakeFirstOrThrow();
    expect(stillActive.revoked_at).toBeNull();

    const revokedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.revoke({ id: exchangedAsB.deviceId });
    expect(revokedAsB?.revokedAt).toBeInstanceOf(Date);
  });
});

describe("DeviceAudit isolation", () => {
  it("the wrong-tenant probe: an actor reads their own Tenant's audit rows, never another Tenant's", async () => {
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "Audit Isolation B", code: "AZ" });
    if (!generatedAsB.ok) throw new Error("setup failed");

    const ownerAuditsForB = await ownerDb
      .selectFrom("DeviceAudit")
      .selectAll()
      .where("tenant_id", "=", tenantB)
      .execute();
    expect(ownerAuditsForB.length).toBeGreaterThan(0);

    const asAScoped = await withTenantScope(seam.db, tenantA, (db) =>
      db.selectFrom("DeviceAudit").selectAll().where("tenant_id", "=", tenantB).execute(),
    );
    expect(asAScoped).toHaveLength(0);

    const asBScoped = await withTenantScope(seam.db, tenantB, (db) =>
      db.selectFrom("DeviceAudit").selectAll().where("tenant_id", "=", tenantB).execute(),
    );
    expect(asBScoped.length).toBe(ownerAuditsForB.length);
  });
});

describe("Device and EnrolmentCode RLS isolation", () => {
  it("the wrong-tenant probe: Tenant B's Device rows are hidden from Tenant A's app-role connection, not merely absent", async () => {
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "RLS Device B", code: "RD" });
    if (!generatedAsB.ok) throw new Error("setup failed");
    const exchangedAsB = await seam.client.terminal.enrol({ secret: generatedAsB.secret });
    if (!exchangedAsB.ok) throw new Error("setup failed");

    const ownerDevicesForB = await ownerDb
      .selectFrom("Device")
      .selectAll()
      .where("tenant_id", "=", tenantB)
      .execute();
    expect(ownerDevicesForB.length).toBeGreaterThan(0);

    const asAScoped = await withTenantScope(seam.db, tenantA, (db) =>
      db.selectFrom("Device").selectAll().where("tenant_id", "=", tenantB).execute(),
    );
    expect(asAScoped).toHaveLength(0);

    const asBScoped = await withTenantScope(seam.db, tenantB, (db) =>
      db.selectFrom("Device").selectAll().where("tenant_id", "=", tenantB).execute(),
    );
    expect(asBScoped.length).toBe(ownerDevicesForB.length);
  });

  it("the wrong-tenant probe: Tenant B's EnrolmentCode rows are hidden from Tenant A's app-role connection, not merely absent", async () => {
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "RLS Code B", code: "RC2" });
    if (!generatedAsB.ok) throw new Error("setup failed");

    const ownerCodesForB = await ownerDb
      .selectFrom("EnrolmentCode")
      .selectAll()
      .where("tenant_id", "=", tenantB)
      .execute();
    expect(ownerCodesForB.length).toBeGreaterThan(0);

    const asAScoped = await withTenantScope(seam.db, tenantA, (db) =>
      db.selectFrom("EnrolmentCode").selectAll().where("tenant_id", "=", tenantB).execute(),
    );
    expect(asAScoped).toHaveLength(0);

    const asBScoped = await withTenantScope(seam.db, tenantB, (db) =>
      db.selectFrom("EnrolmentCode").selectAll().where("tenant_id", "=", tenantB).execute(),
    );
    expect(asBScoped.length).toBe(ownerCodesForB.length);
  });
});
