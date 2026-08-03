import { randomUUID } from "node:crypto";

import { hashPassword } from "backend/src/common/password.ts";
import { createDb, type DatabaseInstance, sql, withTenantScope } from "backend/src/db/client.ts";
import { consumeOverride } from "backend/src/override/db-operations/commands/consume-override.command.ts";
import { insertOverride } from "backend/src/override/db-operations/commands/insert-override.command.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { seedTenantUser } from "../src/seed-tenant-user.ts";

// Issue 12, record 060 Q2: consumeOverride, tested directly. The unique
// index (tenant_id, override_id) is the control, not ON CONFLICT.
const ownerDb: DatabaseInstance = createDb({ databaseUrl: process.env.DATABASE_URI! });
const appDb: DatabaseInstance = createDb({ databaseUrl: process.env.APP_DATABASE_URI! });

const tenantId = randomUUID();
const storeId = randomUUID();
const deviceId = randomUUID();
const approverId = randomUUID();

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Consumption Tenant" }).execute();
  await seedTenantUser(ownerDb, {
    id: approverId,
    tenantId,
    email: `consume-${randomUUID()}@consume.test`,
    passwordHash: await hashPassword("irrelevant"),
    role: "manager",
  });
  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("Store")
      .values({ id: storeId, tenant_id: tenantId, name: "Consumption Store" })
      .execute(),
  );
  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("Device")
      .values({
        id: deviceId,
        tenant_id: tenantId,
        store_id: storeId,
        name: "Consumption Terminal",
        code: "CN",
        token_hash: `consume-hash-${deviceId}`,
      })
      .execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("OverrideConsumption").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Override").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Device").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await appDb.destroy();
});

async function seedOverride() {
  const id = randomUUID();
  await withTenantScope(ownerDb, tenantId, (db) =>
    insertOverride(db, {
      id,
      tenantId,
      storeId,
      deviceId,
      approverUserId: approverId,
      actionType: "void_paid_order",
      reason: "Rung up in error",
      note: null,
      approvedAt: new Date(),
    }),
  );
  return id;
}

const toSettled = <T>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ status: "rejected" as const, reason }),
  );

describe("consumeOverride", () => {
  it("consumes an Override exactly once; the second attempt refuses", async () => {
    const overrideId = await seedOverride();

    const first = await withTenantScope(appDb, tenantId, (db) =>
      consumeOverride(db, {
        tenantId,
        overrideId,
        actionType: "void_paid_order",
        storeId,
        subjectKind: "order",
        subjectId: randomUUID(),
      }),
    );
    expect(first).toBe(true);

    const second = await withTenantScope(appDb, tenantId, (db) =>
      consumeOverride(db, {
        tenantId,
        overrideId,
        actionType: "void_paid_order",
        storeId,
        subjectKind: "order",
        subjectId: randomUUID(),
      }),
    );
    expect(second).toBe(false);

    const rows = await ownerDb
      .selectFrom("OverrideConsumption")
      .selectAll()
      .where("override_id", "=", overrideId)
      .execute();
    expect(rows).toHaveLength(1);
  });

  it("refuses an unknown Override, a wrong action type, and a wrong Store, all with the same false", async () => {
    const overrideId = await seedOverride();

    const unknown = await withTenantScope(appDb, tenantId, (db) =>
      consumeOverride(db, {
        tenantId,
        overrideId: randomUUID(),
        actionType: "void_paid_order",
        storeId,
        subjectKind: "order",
        subjectId: randomUUID(),
      }),
    );
    expect(unknown).toBe(false);

    const wrongAction = await withTenantScope(appDb, tenantId, (db) =>
      consumeOverride(db, {
        tenantId,
        overrideId,
        actionType: "refund",
        storeId,
        subjectKind: "order",
        subjectId: randomUUID(),
      }),
    );
    expect(wrongAction).toBe(false);

    const wrongStore = await withTenantScope(appDb, tenantId, (db) =>
      consumeOverride(db, {
        tenantId,
        overrideId,
        actionType: "void_paid_order",
        storeId: randomUUID(),
        subjectKind: "order",
        subjectId: randomUUID(),
      }),
    );
    expect(wrongStore).toBe(false);
  });

  // Not negotiable (record 060 Q2): two genuinely concurrent transactions on
  // two separate connections, the first held open until the second has
  // issued its statement. A sequential loop does not test this.
  it("two genuinely concurrent consumeOverride calls: exactly one true, one false, exactly one row", async () => {
    const overrideId = await seedOverride();

    let releaseFirst!: () => void;
    const firstReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let signalInserted!: () => void;
    const firstInserted = new Promise<void>((resolve) => {
      signalInserted = resolve;
    });

    const first = toSettled(
      withTenantScope(appDb, tenantId, async (db) => {
        const result = await consumeOverride(db, {
          tenantId,
          overrideId,
          actionType: "void_paid_order",
          storeId,
          subjectKind: "order",
          subjectId: randomUUID(),
        });
        signalInserted();
        await firstReleased;
        return result;
      }),
    );

    await firstInserted;
    const second = toSettled(
      withTenantScope(appDb, tenantId, (db) =>
        consumeOverride(db, {
          tenantId,
          overrideId,
          actionType: "void_paid_order",
          storeId,
          subjectKind: "order",
          subjectId: randomUUID(),
        }),
      ),
    );

    // Waits until the second attempt is actually blocked behind the first's
    // uncommitted unique-index entry, not a fixed sleep.
    for (let i = 0; i < 500; i++) {
      const { rows } = await sql<{ count: string }>`
        select count(*)::text as count
        from pg_stat_activity
        where wait_event_type = 'Lock'
          and query ilike '%"OverrideConsumption"%'
          and pid <> pg_backend_pid()
      `.execute(ownerDb);
      if (Number(rows[0]?.count ?? 0) >= 1) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    releaseFirst();
    const results = await Promise.all([first, second]);
    const values = results.map((result) =>
      result.status === "fulfilled" ? result.value : "rejected",
    );

    expect(values.filter((value) => value === true)).toHaveLength(1);
    expect(values.filter((value) => value === false)).toHaveLength(1);

    const rows = await ownerDb
      .selectFrom("OverrideConsumption")
      .selectAll()
      .where("override_id", "=", overrideId)
      .execute();
    expect(rows).toHaveLength(1);
  });
});
