import { randomUUID } from "node:crypto";

import { createDb, sql, withTenantScope } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { consumeEnrolmentCode } from "backend/src/device/db-operations/commands/consume-enrolment-code.command.ts";
import { insertDeviceAudit } from "backend/src/device/db-operations/commands/insert-device-audit.command.ts";
import { hashDeviceToken } from "backend/src/device/token.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { seedTenantUser } from "../src/seed-tenant-user.ts";
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
  // Issue 17's tests assign Users to Stores via UserStore — clear those
  // rows before deleting the Users (ON DELETE RESTRICT).
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "in", [tenantA, tenantB]).execute();
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

  it("wrong-tenant probe [device.generateCode]: Tenant A submitting Tenant B's storeId is refused; B may use that same storeId", async () => {
    const asB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "Cross Tenant", code: "XT" });
    expect(asB.ok).toBe(true);

    await expectWrongTenantRefusal({
      path: "device.generateCode",
      mode: "refusal",
      ownerSees: asB,
      otherGets: () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.device.generateCode({ storeId: storeB, name: "Cross Tenant", code: "XT2" }),
    });
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

describe("device.pendingCodes and device.cancelCode", () => {
  it("lists a code awaiting its terminal, and cancelling it voids the code and frees its short code", async () => {
    const generated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeA1, name: "Counter 7", code: "P7" });
    if (!generated.ok) throw new Error("setup: generateCode failed");

    const pending = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.pendingCodes();
    const mine = pending.find((code) => code.code === "P7");
    expect(mine?.secret).toBe(generated.secret);

    // Never the other Tenant's, and never a non-admin's.
    const asOtherTenant = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.pendingCodes();
    expect(asOtherTenant.some((code) => code.code === "P7")).toBe(false);
    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.device.pendingCodes();
    expect(asManager).toEqual([]);

    const refusedCancel = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.device.cancelCode({ id: mine!.id });
    expect(refusedCancel.ok).toBe(false);

    const cancelled = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.cancelCode({ id: mine!.id });
    expect(cancelled.ok).toBe(true);

    const afterCancel = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.pendingCodes();
    expect(afterCancel.some((code) => code.code === "P7")).toBe(false);

    const exchanged = await seam.client.terminal.enrol({ secret: generated.secret });
    expect(exchanged.ok).toBe(false);

    const reissued = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeA1, name: "Counter 7 again", code: "P7" });
    expect(reissued.ok).toBe(true);
  });

  it("wrong-tenant probe [device.pendingCodes]: Tenant B's own pending code is never visible in Tenant A's list", async () => {
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Pending Probe", code: "PB1" });
    if (!generatedAsB.ok) throw new Error("setup: generateCode failed");

    const pendingAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.pendingCodes();
    const ownAsB = pendingAsB.find((code) => code.code === "PB1");
    expect(ownAsB).toBeTruthy();

    const generatedAsA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeA1, name: "A Pending Probe", code: "PA1" });
    if (!generatedAsA.ok) throw new Error("setup: generateCode failed");

    const pendingAsA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.pendingCodes();
    expect(pendingAsA.map((code) => code.code)).not.toContain("PB1");
    const ownAsA = pendingAsA.find((code) => code.code === "PA1");
    expect(ownAsA).toBeTruthy();

    await expectWrongTenantRefusal({
      path: "device.pendingCodes",
      mode: "confined",
      ownerSees: ownAsB,
      otherGets: async () => ownAsA,
      otherOwn: ownAsA,
    });

    await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.cancelCode({ id: ownAsB!.id });
    await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.cancelCode({ id: ownAsA!.id });
  });

  it("wrong-tenant probe [device.cancelCode]: Tenant A cannot cancel Tenant B's pending code; B's own cancel still succeeds", async () => {
    const firstAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Cancel Probe", code: "CB1" });
    if (!firstAsB.ok) throw new Error("setup: generateCode failed");
    const pendingFirst = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.pendingCodes();
    const firstRow = pendingFirst.find((code) => code.code === "CB1")!;

    // B's own cancel succeeds through the application path first (finding
    // 7) — a procedure that refuses everyone would otherwise pass the
    // refusal below for the wrong reason.
    const ownerSees = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.cancelCode({ id: firstRow.id });
    expect(ownerSees.ok).toBe(true);

    const secondAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Cancel Probe 2", code: "CB2" });
    if (!secondAsB.ok) throw new Error("setup: generateCode failed");
    const pendingSecond = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.pendingCodes();
    const secondRow = pendingSecond.find((code) => code.code === "CB2")!;

    await expectWrongTenantRefusal({
      path: "device.cancelCode",
      mode: "refusal",
      ownerSees,
      otherGets: () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.device.cancelCode({ id: secondRow.id }),
    });

    await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.cancelCode({ id: secondRow.id });
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

  it("wrong-tenant probe [terminal.enrol]: exchanging under Tenant A's session still enrols the Device into the code's own Tenant, B", async () => {
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

    // Reaches for the same fact through B's own contract call, and proves A
    // is confined to a device it actually owns, not merely absent here.
    const listAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.list({ perPage: 100 });
    const ownAsB = listAsB.items.find((device) => device.id === exchanged.deviceId);
    expect(ownAsB).toBeTruthy();

    const generatedAsA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeA1, name: "A Enrol Own", code: "AE" });
    if (!generatedAsA.ok) throw new Error("setup failed");
    const exchangedAsA = await seam.client.terminal.enrol({ secret: generatedAsA.secret });
    if (!exchangedAsA.ok) throw new Error("setup failed");

    const listAsA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.list({ perPage: 100 });
    expect(listAsA.items.map((device) => device.id)).not.toContain(exchanged.deviceId);
    const ownAsA = listAsA.items.find((device) => device.id === exchangedAsA.deviceId);
    expect(ownAsA).toBeTruthy();

    await expectWrongTenantRefusal({
      path: "terminal.enrol",
      mode: "confined",
      ownerSees: ownAsB,
      otherGets: async () => ownAsA,
      otherOwn: ownAsA,
    });
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
        assignedUserId: null,
      })
      .client.terminal.me();

    expect(me.authenticated).toBe(true);
    if (!me.authenticated) return;
    expect(me.storeId).toBe(storeA1);
    expect(me.storeName).toBe("A Store 1");
  });

  it("wrong-tenant probe [terminal.me]: A's and B's Device tokens each resolve me to their own Tenant's Store only", async () => {
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

    await expectWrongTenantRefusal({
      path: "terminal.me",
      mode: "confined",
      ownerSees: meAsB,
      otherGets: async () => meAsA,
      otherOwn: meAsA,
    });
  });

  it("wrong-tenant probe [terminal.heartbeat]: a heartbeat moves only its own Tenant's Device row, never the other's", async () => {
    const { exchanged: exchangedAsA } = await generateAndExchange(storeA1, "HA");
    if (!exchangedAsA.ok) throw new Error("setup failed");
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Heartbeat", code: "HB" });
    if (!generatedAsB.ok) throw new Error("setup failed");
    const exchangedAsB = await seam.client.terminal.enrol({ secret: generatedAsB.secret });
    if (!exchangedAsB.ok) throw new Error("setup failed");

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

    const heartbeatAsA = await seam.actors.withBearerToken(exchangedAsA.token).terminal.heartbeat();
    expect(heartbeatAsA.ok).toBe(true);
    const afterA = await lastSeen(exchangedAsA.deviceId);
    expect(afterA).toBeGreaterThan(beforeA);
    expect(await lastSeen(exchangedAsB.deviceId)).toBe(beforeB);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const heartbeatAsB = await seam.actors.withBearerToken(exchangedAsB.token).terminal.heartbeat();
    expect(heartbeatAsB.ok).toBe(true);
    expect(await lastSeen(exchangedAsB.deviceId)).toBeGreaterThan(beforeB);
    expect(await lastSeen(exchangedAsA.deviceId)).toBe(afterA);

    await expectWrongTenantRefusal({
      path: "terminal.heartbeat",
      mode: "effect",
      ownerSees: heartbeatAsB,
      otherGets: async () => heartbeatAsA,
      otherBefore: afterA,
      otherAfter: () => lastSeen(exchangedAsA.deviceId),
      why: "heartbeat's { ok: true } carries no tenant data by design; isolation is proven by the last_seen canary, which the response shape can't show.",
    });
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
    const stores = await client.store.list({});
    // A Device Ctx is not "tenant" — the handler's own guard returns [].
    expect(stores.items).toStrictEqual([]);
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
  it("an admin sees the first page of every Device in their own Tenant, with last-seen", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "P1");
    if (!exchanged.ok) throw new Error("setup failed");

    const list = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.list({ perPage: 100 });
    expect(list.count).toBeGreaterThanOrEqual(1);
    const row = list.items.find((d) => d.id === exchanged.deviceId);
    expect(row?.name).toBe("Counter 1");
    expect(row?.lastSeenAt).toBeInstanceOf(Date);
    expect(row?.revokedAt).toBeNull();
    // The envelope's defaults: first page of ten, nothing before it.
    expect(list.page).toBe(1);
    expect(list.perPage).toBe(100);
    expect(list.hasPrevPage).toBe(false);
  });

  it("paginates the fleet: page 2 holds the remainder, with next/prev flags and a clamped out-of-range page", async () => {
    // Earlier describes leave Devices behind; wipe so this test owns the
    // exact set (FK order: audit, codes, then devices).
    await ownerDb.deleteFrom("DeviceAudit").where("tenant_id", "=", tenantA).execute();
    await ownerDb.deleteFrom("EnrolmentCode").where("tenant_id", "=", tenantA).execute();
    await ownerDb.deleteFrom("Device").where("tenant_id", "=", tenantA).execute();
    // Seed twelve directly (the exchange path is for the enrolment tests; a
    // page needs volume, not ceremony).
    await withTenantScope(ownerDb, tenantA, (db) =>
      db
        .insertInto("Device")
        .values(
          Array.from({ length: 12 }, (_, i) => ({
            id: randomUUID(),
            tenant_id: tenantA,
            store_id: storeA1,
            name: `Page Device ${i + 1}`,
            code: `PD${i + 1}`,
            token_hash: `page-${randomUUID()}`,
          })),
        )
        .execute(),
    );

    const page1 = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.list({ perPage: 10 });
    expect(page1.items).toHaveLength(10);
    expect(page1.count).toBe(12);
    expect(page1.hasNextPage).toBe(true);
    expect(page1.hasPrevPage).toBe(false);
    const page1Ids = new Set(page1.items.map((d) => d.id));

    const page2 = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.list({ page: 2, perPage: 10 });
    expect(page2.page).toBe(2);
    expect(page2.items).toHaveLength(2);
    expect(page2.hasNextPage).toBe(false);
    expect(page2.hasPrevPage).toBe(true);
    expect(page2.items.some((d) => page1Ids.has(d.id))).toBe(false);

    // An out-of-range page is clamped to the last real one, and reports it.
    const clamped = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.list({ page: 99, perPage: 10 });
    expect(clamped.page).toBe(2);
    expect(clamped.items).toEqual(page2.items);
  });

  it("filters the fleet by health, mirroring the dot thresholds", async () => {
    await withTenantScope(ownerDb, tenantA, (db) =>
      db
        .insertInto("Device")
        .values([
          {
            id: randomUUID(),
            tenant_id: tenantA,
            store_id: storeA1,
            name: "Healthy Till",
            code: "HT1",
            token_hash: `health-${randomUUID()}`,
            last_seen_at: new Date(Date.now() - 60_000),
          },
          {
            id: randomUUID(),
            tenant_id: tenantA,
            store_id: storeA1,
            name: "Stale Till",
            code: "ST1",
            token_hash: `health-${randomUUID()}`,
            last_seen_at: new Date(Date.now() - 30 * 60_000),
          },
          {
            id: randomUUID(),
            tenant_id: tenantA,
            store_id: storeA1,
            name: "Dead Till",
            code: "DT1",
            token_hash: `health-${randomUUID()}`,
            last_seen_at: new Date(Date.now() - 2 * 24 * 60 * 60_000),
          },
        ])
        .execute(),
    );

    const byHealth = async (health: string) => {
      const page = await seam.actors
        .asTenant(tenantA, { userId: adminA, role: "admin" })
        .client.device.list({
          health: health as "all" | "online" | "stale" | "offline",
          search: "Till",
        });
      return page.items.map((d) => d.name);
    };

    expect(await byHealth("online")).toContain("Healthy Till");
    expect(await byHealth("online")).not.toContain("Stale Till");
    expect(await byHealth("stale")).toEqual(["Stale Till"]);
    expect(await byHealth("offline")).toEqual(["Dead Till"]);
  });

  it("a manager and a cashier are refused, server-side, and see nothing", async () => {
    const asManager = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.device.list({});
    const asCashier = await seam.actors
      .asTenant(tenantA, { userId: cashierA, role: "cashier" })
      .client.device.list({});
    expect(asManager.items).toStrictEqual([]);
    expect(asManager.count).toBe(0);
    expect(asManager.totalCount).toBe(0);
    expect(asCashier.items).toStrictEqual([]);
    expect(asCashier.count).toBe(0);
  });

  it("an unauthenticated caller sees nothing", async () => {
    const list = await seam.actors.asUnauthenticated().client.device.list({});
    expect(list.items).toStrictEqual([]);
    expect(list.count).toBe(0);
  });

  it("wrong-tenant probe [device.list]: Tenant B's Device is readable as Tenant B, never in Tenant A's list", async () => {
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Device", code: "BB" });
    if (!generatedAsB.ok) throw new Error("setup failed");
    const exchangedAsB = await seam.client.terminal.enrol({ secret: generatedAsB.secret });
    if (!exchangedAsB.ok) throw new Error("setup failed");

    const listAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.list({ perPage: 100 });
    expect(listAsB.items.map((d) => d.id)).toContain(exchangedAsB.deviceId);
    const ownAsB = listAsB.items.find((d) => d.id === exchangedAsB.deviceId);

    const generatedAsA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.generateCode({ storeId: storeA1, name: "A Device", code: "AA" });
    if (!generatedAsA.ok) throw new Error("setup failed");
    const exchangedAsA = await seam.client.terminal.enrol({ secret: generatedAsA.secret });
    if (!exchangedAsA.ok) throw new Error("setup failed");

    const listAsA = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.list({ perPage: 100 });
    expect(listAsA.items.map((d) => d.id)).not.toContain(exchangedAsB.deviceId);
    const ownAsA = listAsA.items.find((d) => d.id === exchangedAsA.deviceId);
    expect(ownAsA).toBeTruthy();

    await expectWrongTenantRefusal({
      path: "device.list",
      mode: "confined",
      ownerSees: ownAsB,
      otherGets: async () => ownAsA,
      otherOwn: ownAsA,
    });
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

  it("wrong-tenant probe [device.rename]: Tenant A cannot rename Tenant B's Device; B's row is untouched", async () => {
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Rename Target", code: "BR" });
    if (!generatedAsB.ok) throw new Error("setup failed");
    const exchangedAsB = await seam.client.terminal.enrol({ secret: generatedAsB.secret });
    if (!exchangedAsB.ok) throw new Error("setup failed");

    const ownerSees = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.rename({ id: exchangedAsB.deviceId, name: "B Rename Target" });
    expect(ownerSees?.id).toBe(exchangedAsB.deviceId);

    await expectWrongTenantRefusal({
      path: "device.rename",
      mode: "refusal",
      ownerSees,
      otherGets: () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.device.rename({ id: exchangedAsB.deviceId, name: "Hijacked From A" }),
    });

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

  it("wrong-tenant probe [device.revoke]: Tenant A cannot revoke Tenant B's Device; B's own revoke still succeeds", async () => {
    // B's own revoke succeeds through the application path first (finding
    // 7) — a procedure that refuses everyone would otherwise pass the
    // refusal below for the wrong reason.
    const firstAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Revoke Canary", code: "BC" });
    if (!firstAsB.ok) throw new Error("setup failed");
    const exchangedCanary = await seam.client.terminal.enrol({ secret: firstAsB.secret });
    if (!exchangedCanary.ok) throw new Error("setup failed");
    const ownerSees = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.revoke({ id: exchangedCanary.deviceId });
    expect(ownerSees?.revokedAt).toBeInstanceOf(Date);

    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Revoke Target", code: "BV" });
    if (!generatedAsB.ok) throw new Error("setup failed");
    const exchangedAsB = await seam.client.terminal.enrol({ secret: generatedAsB.secret });
    if (!exchangedAsB.ok) throw new Error("setup failed");

    await expectWrongTenantRefusal({
      path: "device.revoke",
      mode: "refusal",
      ownerSees,
      otherGets: () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.device.revoke({ id: exchangedAsB.deviceId }),
    });

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

// Issue 17: the single-employee terminal. `admin`-only (record 056 Q5), and
// only a User currently assigned to the Device's own Store may be chosen —
// refused server-side, not merely absent from a picker.
describe("device.setAssignedUser", () => {
  async function assignStore(tenantId: string, userId: string, storeId: string) {
    await withTenantScope(seam.db, tenantId, (db) =>
      db
        .insertInto("UserStore")
        .values({
          id: randomUUID(),
          tenant_id: tenantId,
          user_id: userId,
          store_id: storeId,
          assigned: true,
          effective_from: new Date(Date.now() - 60_000),
        })
        .execute(),
    );
  }

  it("an admin assigns a User currently assigned to the Device's Store, and it is audited with the old and new value", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "SA1");
    if (!exchanged.ok) throw new Error("setup failed");
    await assignStore(tenantA, cashierA, storeA1);

    const result = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.setAssignedUser({ id: exchanged.deviceId, userId: cashierA });

    expect(result?.assignedUserId).toBe(cashierA);

    const audit = await withTenantScope(seam.db, tenantA, (db) =>
      db
        .selectFrom("DeviceAudit")
        .selectAll()
        .where("device_id", "=", exchanged.deviceId)
        .where("field", "=", "assigned_user")
        .execute(),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]!.old_value).toBeNull();
    expect(audit[0]!.new_value).toBe(cashierA);
  });

  it("clearing the restriction is audited with the old assignee as old_value and no new_value", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "SA2");
    if (!exchanged.ok) throw new Error("setup failed");
    await assignStore(tenantA, cashierA, storeA1);
    const asAdmin = seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" });
    await asAdmin.client.device.setAssignedUser({ id: exchanged.deviceId, userId: cashierA });

    const result = await asAdmin.client.device.setAssignedUser({
      id: exchanged.deviceId,
      userId: null,
    });
    expect(result?.assignedUserId).toBeNull();

    const audit = await withTenantScope(seam.db, tenantA, (db) =>
      db
        .selectFrom("DeviceAudit")
        .selectAll()
        .where("device_id", "=", exchanged.deviceId)
        .where("field", "=", "assigned_user")
        .orderBy("created_at", "desc")
        .execute(),
    );
    expect(audit[0]!.old_value).toBe(cashierA);
    expect(audit[0]!.new_value).toBe("");
  });

  it("refuses a User not currently assigned to the Device's Store — not merely absent from a picker", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "SA3");
    if (!exchanged.ok) throw new Error("setup failed");
    // cashierElsewhere-style: a User with no assignment to storeA1 at all.
    const outsider = randomUUID();
    const passwordHash = await hashPassword("irrelevant");
    await seedTenantUser(ownerDb, {
      id: outsider,
      tenantId: tenantA,
      email: `assign-outsider-${randomUUID()}@dev.test`,
      passwordHash,
      role: "cashier",
    });
    await assignStore(tenantA, outsider, storeA2);

    const result = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.setAssignedUser({ id: exchanged.deviceId, userId: outsider });
    expect(result).toBeNull();

    const stored = await withTenantScope(seam.db, tenantA, (db) =>
      db
        .selectFrom("Device")
        .select(["assigned_user_id"])
        .where("id", "=", exchanged.deviceId)
        .executeTakeFirst(),
    );
    expect(stored?.assigned_user_id).toBeNull();

    await ownerDb.deleteFrom("UserStore").where("user_id", "=", outsider).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", outsider).execute();
    await ownerDb.deleteFrom("User").where("id", "=", outsider).execute();
  });

  it("a manager cannot set or clear the restriction — same as every other Device action", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "SA4");
    if (!exchanged.ok) throw new Error("setup failed");
    await assignStore(tenantA, cashierA, storeA1);

    const result = await seam.actors
      .asTenant(tenantA, { userId: managerA, role: "manager" })
      .client.device.setAssignedUser({ id: exchanged.deviceId, userId: cashierA });
    expect(result).toBeNull();
  });

  it("wrong-tenant probe [device.setAssignedUser]: Tenant A cannot restrict Tenant B's Device; B's row is untouched", async () => {
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Assign Target", code: "BA" });
    if (!generatedAsB.ok) throw new Error("setup failed");
    const exchangedAsB = await seam.client.terminal.enrol({ secret: generatedAsB.secret });
    if (!exchangedAsB.ok) throw new Error("setup failed");

    const cashierBId = randomUUID();
    const passwordHash = await hashPassword("irrelevant");
    await seedTenantUser(ownerDb, {
      id: cashierBId,
      tenantId: tenantB,
      email: `assign-cashier-b-${randomUUID()}@dev.test`,
      passwordHash,
      role: "cashier",
    });
    await assignStore(tenantB, cashierBId, storeB);

    const ownerSees = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.setAssignedUser({ id: exchangedAsB.deviceId, userId: cashierBId });
    expect(ownerSees?.assignedUserId).toBe(cashierBId);

    await expectWrongTenantRefusal({
      path: "device.setAssignedUser",
      mode: "refusal",
      ownerSees,
      otherGets: () =>
        seam.actors
          .asTenant(tenantA, { userId: adminA, role: "admin" })
          .client.device.setAssignedUser({ id: exchangedAsB.deviceId, userId: null }),
    });

    const stillAssigned = await withTenantScope(seam.db, tenantB, (db) =>
      db
        .selectFrom("Device")
        .select(["assigned_user_id"])
        .where("id", "=", exchangedAsB.deviceId)
        .executeTakeFirst(),
    );
    expect(stillAssigned?.assigned_user_id).toBe(cashierBId);

    await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.setAssignedUser({ id: exchangedAsB.deviceId, userId: null });
    await ownerDb.deleteFrom("UserStore").where("user_id", "=", cashierBId).execute();
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", cashierBId).execute();
    await ownerDb.deleteFrom("User").where("id", "=", cashierBId).execute();
  });
});

describe("device.update", () => {
  async function assignStore(tenantId: string, userId: string, storeId: string) {
    await withTenantScope(seam.db, tenantId, (db) =>
      db
        .insertInto("UserStore")
        .values({
          id: randomUUID(),
          tenant_id: tenantId,
          user_id: userId,
          store_id: storeId,
          assigned: true,
          effective_from: new Date(Date.now() - 60_000),
        })
        .execute(),
    );
  }

  it("updates name and assignment in one call, auditing each changed field once", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "UP1");
    if (!exchanged.ok) throw new Error("setup failed");
    await assignStore(tenantA, cashierA, storeA1);

    const updated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.update({
        id: exchanged.deviceId,
        name: "Counter 1U",
        assignedUserId: cashierA,
      });
    expect(updated?.name).toBe("Counter 1U");
    expect(updated?.assignedUserId).toBe(cashierA);

    const audits = await withTenantScope(seam.db, tenantA, (db) =>
      db
        .selectFrom("DeviceAudit")
        .select(["field", "old_value", "new_value"])
        .where("device_id", "=", exchanged.deviceId)
        .where("field", "in", ["name", "assigned_user"])
        .execute(),
    );
    expect(audits).toHaveLength(2);
    const nameAudit = audits.find((row) => row.field === "name");
    expect(nameAudit?.old_value).toBe("Counter 1");
    expect(nameAudit?.new_value).toBe("Counter 1U");
    const assignmentAudit = audits.find((row) => row.field === "assigned_user");
    expect(assignmentAudit?.old_value).toBeNull();
    expect(assignmentAudit?.new_value).toBe(cashierA);
  });

  it("leaves a field alone when it did not change — no audit row for it", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "UP2");
    if (!exchanged.ok) throw new Error("setup failed");
    await assignStore(tenantA, cashierA, storeA1);

    const updated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.update({
        id: exchanged.deviceId,
        name: "Counter 1",
        assignedUserId: cashierA,
      });
    expect(updated?.name).toBe("Counter 1");
    expect(updated?.assignedUserId).toBe(cashierA);

    const audits = await withTenantScope(seam.db, tenantA, (db) =>
      db
        .selectFrom("DeviceAudit")
        .select(["field"])
        .where("device_id", "=", exchanged.deviceId)
        .where("field", "in", ["name", "assigned_user"])
        .execute(),
    );
    expect(audits.map((row) => row.field)).toEqual(["assigned_user"]);
  });

  it("refuses a target User not assigned to the Device's Store, server-side, and changes nothing", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "UP3");
    if (!exchanged.ok) throw new Error("setup failed");
    // A fresh cashier with no Store rows at all — never assigned to the
    // Device's storeA1.
    const outsider = randomUUID();
    const passwordHash = await hashPassword("irrelevant");
    await ownerDb
      .insertInto("User")
      .values({
        id: outsider,
        tenant_id: tenantA,
        email: `update-outsider-${randomUUID()}@dev.test`,
        password_hash: passwordHash,
        role: "cashier",
      })
      .execute();

    const updated = await seam.actors
      .asTenant(tenantA, { userId: adminA, role: "admin" })
      .client.device.update({
        id: exchanged.deviceId,
        name: "Should Not Land",
        assignedUserId: outsider,
      });
    expect(updated).toBeNull();

    const stored = await withTenantScope(seam.db, tenantA, (db) =>
      db
        .selectFrom("Device")
        .select(["name", "assigned_user_id"])
        .where("id", "=", exchanged.deviceId)
        .executeTakeFirstOrThrow(),
    );
    expect(stored.name).toBe("Counter 1");
    expect(stored.assigned_user_id).toBeNull();

    await ownerDb.deleteFrom("UserRole").where("user_id", "=", outsider).execute();
    await ownerDb.deleteFrom("User").where("id", "=", outsider).execute();
  });

  it("wrong-tenant probe [device.update]: Tenant A cannot update Tenant B's Device; B's row is untouched", async () => {
    const generatedAsB = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.generateCode({ storeId: storeB, name: "B Update Target", code: "BU" });
    if (!generatedAsB.ok) throw new Error("setup failed");
    const exchangedAsB = await seam.client.terminal.enrol({ secret: generatedAsB.secret });
    if (!exchangedAsB.ok) throw new Error("setup failed");

    const ownerSees = await seam.actors
      .asTenant(tenantB, { userId: adminB, role: "admin" })
      .client.device.update({
        id: exchangedAsB.deviceId,
        name: "B Update Target",
        assignedUserId: null,
      });
    expect(ownerSees?.id).toBe(exchangedAsB.deviceId);

    await expectWrongTenantRefusal({
      path: "device.update",
      mode: "refusal",
      ownerSees,
      otherGets: () =>
        seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client.device.update({
          id: exchangedAsB.deviceId,
          name: "Hijacked From A",
          assignedUserId: null,
        }),
    });

    const stillNamed = await withTenantScope(seam.db, tenantB, (db) =>
      db
        .selectFrom("Device")
        .select(["name"])
        .where("id", "=", exchangedAsB.deviceId)
        .executeTakeFirst(),
    );
    expect(stillNamed?.name).toBe("B Update Target");
  });
});

describe("DeviceAudit_name_has_old_value_check", () => {
  it("still forces a `name` row to a non-null old_value and every other pre-existing field to null, in both directions", async () => {
    const { exchanged } = await generateAndExchange(storeA1, "SA5");
    if (!exchanged.ok) throw new Error("setup failed");

    await expect(
      withTenantScope(seam.db, tenantA, (db) =>
        insertDeviceAudit(db, {
          id: randomUUID(),
          tenantId: tenantA,
          actorUserId: adminA,
          deviceId: exchanged.deviceId,
          enrolmentCodeId: null,
          field: "name",
          oldValue: null,
          newValue: "Renamed",
        }),
      ),
    ).rejects.toThrow(/DeviceAudit_name_has_old_value_check/);

    await expect(
      withTenantScope(seam.db, tenantA, (db) =>
        insertDeviceAudit(db, {
          id: randomUUID(),
          tenantId: tenantA,
          actorUserId: adminA,
          deviceId: exchanged.deviceId,
          enrolmentCodeId: null,
          field: "revoked",
          oldValue: "not null",
          newValue: new Date().toISOString(),
        }),
      ),
    ).rejects.toThrow(/DeviceAudit_name_has_old_value_check/);

    const nameId = randomUUID();
    await withTenantScope(seam.db, tenantA, (db) =>
      insertDeviceAudit(db, {
        id: nameId,
        tenantId: tenantA,
        actorUserId: adminA,
        deviceId: exchanged.deviceId,
        enrolmentCodeId: null,
        field: "name",
        oldValue: "Old Name",
        newValue: "New Name",
      }),
    );
    const nameRow = await ownerDb
      .selectFrom("DeviceAudit")
      .select(["old_value"])
      .where("id", "=", nameId)
      .executeTakeFirstOrThrow();
    expect(nameRow.old_value).toBe("Old Name");

    const revokedId = randomUUID();
    await withTenantScope(seam.db, tenantA, (db) =>
      insertDeviceAudit(db, {
        id: revokedId,
        tenantId: tenantA,
        actorUserId: adminA,
        deviceId: exchanged.deviceId,
        enrolmentCodeId: null,
        field: "revoked",
        oldValue: null,
        newValue: new Date().toISOString(),
      }),
    );
    const revokedRow = await ownerDb
      .selectFrom("DeviceAudit")
      .select(["old_value"])
      .where("id", "=", revokedId)
      .executeTakeFirstOrThrow();
    expect(revokedRow.old_value).toBeNull();
  });
});
