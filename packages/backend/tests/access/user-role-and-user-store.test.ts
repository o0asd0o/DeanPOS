import { randomUUID } from "node:crypto";

import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { getAssignedStoreIdsAsOf } from "../../src/access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import { getRoleAsOf } from "../../src/access/db-operations/queries/get-role-as-of.query.ts";
import { hashPassword } from "../../src/common/password.ts";
import { createDb, type DatabaseInstance, withTenantScope } from "../../src/db/client.ts";

// Fixtures are seeded through the migration owner, the same pattern every
// other RLS test in this suite uses (packages/backend/tests/db/with-tenant-scope.test.ts).
const ownerDb: DatabaseInstance = createDb({ databaseUrl: process.env.DATABASE_URI! });
const appDb: DatabaseInstance = createDb({ databaseUrl: process.env.APP_DATABASE_URI! });

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const storeA1 = randomUUID();
const storeA2 = randomUUID();

beforeAll(async () => {
  // The suite's ownerDb reads only work because this role is a superuser
  // under FORCE ROW LEVEL SECURITY (record 029) — assert the premise so a
  // non-superuser owner fails here, not as a phantom RLS bug downstream.
  const { rows } = await sql<{
    rolsuper: boolean;
  }>`select rolsuper from pg_roles where rolname = current_user`.execute(ownerDb);
  expect(rows[0]?.rolsuper).toBe(true);

  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "Access Tenant A" },
      { id: tenantB, name: "Access Tenant B" },
    ])
    .execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: userA,
      tenant_id: tenantA,
      email: `access-${randomUUID()}@user-role.test`,
      password_hash: await hashPassword("irrelevant"),
      role: "cashier",
    })
    .execute();
  await withTenantScope(appDb, tenantA, (db) =>
    db
      .insertInto("Store")
      .values([
        { id: storeA1, tenant_id: tenantA, name: "A1" },
        { id: storeA2, tenant_id: tenantA, name: "A2" },
      ])
      .execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Store").where("id", "in", [storeA1, storeA2]).execute();
  await ownerDb.deleteFrom("User").where("id", "=", userA).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await appDb.destroy();
});

describe("UserRole and UserStore: append-only, structurally", () => {
  it("deanpos_app can INSERT a UserRole row", async () => {
    await withTenantScope(appDb, tenantA, (db) =>
      db
        .insertInto("UserRole")
        .values({
          id: randomUUID(),
          tenant_id: tenantA,
          user_id: userA,
          role: "cashier",
          effective_from: new Date(),
        })
        .execute(),
    );

    const rows = await withTenantScope(appDb, tenantA, (db) =>
      db.selectFrom("UserRole").selectAll().where("user_id", "=", userA).execute(),
    );
    expect(rows).toHaveLength(1);
  });

  it("an UPDATE against UserRole is refused, not merely discouraged", async () => {
    await expect(
      withTenantScope(appDb, tenantA, (db) =>
        db.updateTable("UserRole").set({ role: "admin" }).where("user_id", "=", userA).execute(),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("a DELETE against UserRole is refused, not merely discouraged", async () => {
    await expect(
      withTenantScope(appDb, tenantA, (db) =>
        db.deleteFrom("UserRole").where("user_id", "=", userA).execute(),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("an UPDATE against UserStore is refused, not merely discouraged", async () => {
    await withTenantScope(appDb, tenantA, (db) =>
      db
        .insertInto("UserStore")
        .values({
          id: randomUUID(),
          tenant_id: tenantA,
          user_id: userA,
          store_id: storeA1,
          assigned: true,
          effective_from: new Date(),
        })
        .execute(),
    );

    await expect(
      withTenantScope(appDb, tenantA, (db) =>
        db.updateTable("UserStore").set({ assigned: false }).where("user_id", "=", userA).execute(),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("a DELETE against UserStore is refused, not merely discouraged", async () => {
    await expect(
      withTenantScope(appDb, tenantA, (db) =>
        db.deleteFrom("UserStore").where("user_id", "=", userA).execute(),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

// Round 2 finding 2: proves the composite FKs themselves reject a mismatched
// tenant, under deanpos_app — not the owner, whose behaviour protects
// nothing. A regenerated schema that restores an independent user_id/store_id
// FK would otherwise pass every other test in this file unnoticed.
describe("UserRole and UserStore: composite FKs reject a mismatched tenant", () => {
  const userB = randomUUID();
  const storeB = randomUUID();

  beforeAll(async () => {
    await ownerDb
      .insertInto("User")
      .values({
        id: userB,
        tenant_id: tenantB,
        email: `access-${randomUUID()}@user-role.test`,
        password_hash: await hashPassword("irrelevant"),
        role: "cashier",
      })
      .execute();
    await withTenantScope(appDb, tenantB, (db) =>
      db.insertInto("Store").values({ id: storeB, tenant_id: tenantB, name: "B1" }).execute(),
    );
  });

  afterAll(async () => {
    await ownerDb.deleteFrom("Store").where("id", "=", storeB).execute();
    await ownerDb.deleteFrom("User").where("id", "=", userB).execute();
  });

  it("UserRole(tenantA, userB) is rejected", async () => {
    await expect(
      withTenantScope(appDb, tenantA, (db) =>
        db
          .insertInto("UserRole")
          .values({
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: userB,
            role: "cashier",
            effective_from: new Date(),
          })
          .execute(),
      ),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("UserStore(tenantA, userB, storeA) is rejected", async () => {
    await expect(
      withTenantScope(appDb, tenantA, (db) =>
        db
          .insertInto("UserStore")
          .values({
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: userB,
            store_id: storeA1,
            assigned: true,
            effective_from: new Date(),
          })
          .execute(),
      ),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it("UserStore(tenantA, userA, storeB) is rejected", async () => {
    await expect(
      withTenantScope(appDb, tenantA, (db) =>
        db
          .insertInto("UserStore")
          .values({
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: userA,
            store_id: storeB,
            assigned: true,
            effective_from: new Date(),
          })
          .execute(),
      ),
    ).rejects.toThrow(/violates foreign key constraint/);
  });
});

describe("UserRole and UserStore: RLS, not application filtering", () => {
  // Identified rows (round 1 finding 5): proving Tenant B and an unscoped
  // connection see nothing is only meaningful once Tenant A is shown to read
  // these exact ids — an empty result would pass with the policies deleted.
  const roleRowId = randomUUID();
  const storeRowId = randomUUID();

  beforeAll(async () => {
    await withTenantScope(appDb, tenantA, (db) =>
      db
        .insertInto("UserRole")
        .values({
          id: roleRowId,
          tenant_id: tenantA,
          user_id: userA,
          role: "manager",
          effective_from: new Date("2026-03-01T00:00:00Z"),
        })
        .execute(),
    );
    await withTenantScope(appDb, tenantA, (db) =>
      db
        .insertInto("UserStore")
        .values({
          id: storeRowId,
          tenant_id: tenantA,
          user_id: userA,
          store_id: storeA2,
          assigned: true,
          effective_from: new Date("2026-03-01T00:00:00Z"),
        })
        .execute(),
    );
  });

  afterAll(async () => {
    await ownerDb.deleteFrom("UserRole").where("id", "=", roleRowId).execute();
    await ownerDb.deleteFrom("UserStore").where("id", "=", storeRowId).execute();
  });

  it("a tenant-scoped connection reads the rows it seeded, by id", async () => {
    const roles = await withTenantScope(appDb, tenantA, (db) =>
      db.selectFrom("UserRole").select("id").where("id", "=", roleRowId).execute(),
    );
    const stores = await withTenantScope(appDb, tenantA, (db) =>
      db.selectFrom("UserStore").select("id").where("id", "=", storeRowId).execute(),
    );
    expect(roles.map((r) => r.id)).toStrictEqual([roleRowId]);
    expect(stores.map((s) => s.id)).toStrictEqual([storeRowId]);
  });

  it("a tenant-scoped connection cannot read another Tenant's UserRole or UserStore rows — the row is there and hidden, not absent", async () => {
    const roles = await withTenantScope(appDb, tenantB, (db) =>
      db.selectFrom("UserRole").select("id").where("id", "=", roleRowId).execute(),
    );
    const stores = await withTenantScope(appDb, tenantB, (db) =>
      db.selectFrom("UserStore").select("id").where("id", "=", storeRowId).execute(),
    );
    expect(roles).toStrictEqual([]);
    expect(stores).toStrictEqual([]);
  });

  it("an unscoped connection issuing the same selects directly sees nothing, for the same known ids", async () => {
    expect(
      await appDb.selectFrom("UserRole").select("id").where("id", "=", roleRowId).execute(),
    ).toStrictEqual([]);
    expect(
      await appDb.selectFrom("UserStore").select("id").where("id", "=", storeRowId).execute(),
    ).toStrictEqual([]);
  });
});

describe("un-assigning a Store writes a closing row; the previous assignment stays readable", () => {
  const userB = randomUUID();
  const t1 = new Date("2026-01-01T00:00:00Z");
  const t2 = new Date("2026-01-10T00:00:00Z");

  beforeAll(async () => {
    await ownerDb
      .insertInto("User")
      .values({
        id: userB,
        tenant_id: tenantA,
        email: `access-${randomUUID()}@user-role.test`,
        password_hash: await hashPassword("irrelevant"),
        role: "manager",
      })
      .execute();
    await withTenantScope(appDb, tenantA, (db) =>
      db
        .insertInto("UserStore")
        .values([
          {
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: userB,
            store_id: storeA1,
            assigned: true,
            effective_from: t1,
          },
          {
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: userB,
            store_id: storeA1,
            assigned: false,
            effective_from: t2,
          },
        ])
        .execute(),
    );
  });

  afterAll(async () => {
    await ownerDb.deleteFrom("UserStore").where("user_id", "=", userB).execute();
    await ownerDb.deleteFrom("User").where("id", "=", userB).execute();
  });

  it("both the opening and the closing row remain readable", async () => {
    const rows = await withTenantScope(appDb, tenantA, (db) =>
      db
        .selectFrom("UserStore")
        .selectAll()
        .where("user_id", "=", userB)
        .where("store_id", "=", storeA1)
        .execute(),
    );
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.assigned === true)).toBe(true);
    expect(rows.some((r) => r.assigned === false)).toBe(true);
  });

  it("getAssignedStoreIdsAsOf includes the Store between the opening and closing row", async () => {
    const asOf = new Date("2026-01-05T00:00:00Z");
    const storeIds = await withTenantScope(appDb, tenantA, (db) =>
      getAssignedStoreIdsAsOf(db, userB, asOf),
    );
    expect(storeIds).toContain(storeA1);
  });

  it("getAssignedStoreIdsAsOf excludes the Store on or after the closing row", async () => {
    const storeIds = await withTenantScope(appDb, tenantA, (db) =>
      getAssignedStoreIdsAsOf(db, userB, t2),
    );
    expect(storeIds).not.toContain(storeA1);
  });

  it("getAssignedStoreIdsAsOf excludes the Store before the opening row", async () => {
    const before = new Date("2025-12-31T00:00:00Z");
    const storeIds = await withTenantScope(appDb, tenantA, (db) =>
      getAssignedStoreIdsAsOf(db, userB, before),
    );
    expect(storeIds).not.toContain(storeA1);
  });

  it("getAssignedStoreIdsAsOf excludes the Store strictly after the closing row", async () => {
    const after = new Date("2026-01-20T00:00:00Z");
    const storeIds = await withTenantScope(appDb, tenantA, (db) =>
      getAssignedStoreIdsAsOf(db, userB, after),
    );
    expect(storeIds).not.toContain(storeA1);
  });
});

// Round 1 finding 6: the suite above only ever walks assignment -> closure.
// A Tuesday demotion or un-assignment invalidating a legitimate Monday
// Override is exactly what issue 12 must not do — so the reverse
// transitions get their own coverage, not a mirror-image assumption.
describe("un-assigning then reassigning a Store: closure -> reopening", () => {
  const userD = randomUUID();
  const t1 = new Date("2026-04-01T00:00:00Z");
  const t2 = new Date("2026-04-10T00:00:00Z");
  const t3 = new Date("2026-04-20T00:00:00Z");

  beforeAll(async () => {
    await ownerDb
      .insertInto("User")
      .values({
        id: userD,
        tenant_id: tenantA,
        email: `access-${randomUUID()}@user-role.test`,
        password_hash: await hashPassword("irrelevant"),
        role: "cashier",
      })
      .execute();
    await withTenantScope(appDb, tenantA, (db) =>
      db
        .insertInto("UserStore")
        .values([
          {
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: userD,
            store_id: storeA1,
            assigned: true,
            effective_from: t1,
          },
          {
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: userD,
            store_id: storeA1,
            assigned: false,
            effective_from: t2,
          },
          {
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: userD,
            store_id: storeA1,
            assigned: true,
            effective_from: t3,
          },
        ])
        .execute(),
    );
  });

  afterAll(async () => {
    await ownerDb.deleteFrom("UserStore").where("user_id", "=", userD).execute();
    await ownerDb.deleteFrom("User").where("id", "=", userD).execute();
  });

  it("before the closing row, the Store is still assigned", async () => {
    const asOf = new Date("2026-04-05T00:00:00Z");
    const storeIds = await withTenantScope(appDb, tenantA, (db) =>
      getAssignedStoreIdsAsOf(db, userD, asOf),
    );
    expect(storeIds).toContain(storeA1);
  });

  it("exactly at the closing row, the Store is already un-assigned", async () => {
    const storeIds = await withTenantScope(appDb, tenantA, (db) =>
      getAssignedStoreIdsAsOf(db, userD, t2),
    );
    expect(storeIds).not.toContain(storeA1);
  });

  it("strictly after the closing row but before reopening, the Store stays un-assigned", async () => {
    const asOf = new Date("2026-04-15T00:00:00Z");
    const storeIds = await withTenantScope(appDb, tenantA, (db) =>
      getAssignedStoreIdsAsOf(db, userD, asOf),
    );
    expect(storeIds).not.toContain(storeA1);
  });

  it("exactly at the reopening row, the Store is assigned again", async () => {
    const storeIds = await withTenantScope(appDb, tenantA, (db) =>
      getAssignedStoreIdsAsOf(db, userD, t3),
    );
    expect(storeIds).toContain(storeA1);
  });

  it("strictly after the reopening row, the Store stays assigned", async () => {
    const after = new Date("2026-04-25T00:00:00Z");
    const storeIds = await withTenantScope(appDb, tenantA, (db) =>
      getAssignedStoreIdsAsOf(db, userD, after),
    );
    expect(storeIds).toContain(storeA1);
  });
});

describe("getRoleAsOf: a change on either side of T", () => {
  const userC = randomUUID();
  const t1 = new Date("2026-02-01T00:00:00Z");
  const t2 = new Date("2026-02-10T00:00:00Z");

  beforeAll(async () => {
    await ownerDb
      .insertInto("User")
      .values({
        id: userC,
        tenant_id: tenantA,
        email: `access-${randomUUID()}@user-role.test`,
        password_hash: await hashPassword("irrelevant"),
        role: "manager",
      })
      .execute();
    await withTenantScope(appDb, tenantA, (db) =>
      db
        .insertInto("UserRole")
        .values([
          {
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: userC,
            role: "cashier",
            effective_from: t1,
          },
          {
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: userC,
            role: "manager",
            effective_from: t2,
          },
        ])
        .execute(),
    );
  });

  afterAll(async () => {
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", userC).execute();
    await ownerDb.deleteFrom("User").where("id", "=", userC).execute();
  });

  it("resolves to the role in force before the change", async () => {
    const asOf = new Date("2026-02-05T00:00:00Z");
    const result = await withTenantScope(appDb, tenantA, (db) => getRoleAsOf(db, userC, asOf));
    expect(result?.role).toBe("cashier");
  });

  it("resolves to the role in force exactly at the change", async () => {
    const result = await withTenantScope(appDb, tenantA, (db) => getRoleAsOf(db, userC, t2));
    expect(result?.role).toBe("manager");
  });

  it("resolves to the role in force strictly after the change", async () => {
    const after = new Date("2026-02-15T00:00:00Z");
    const result = await withTenantScope(appDb, tenantA, (db) => getRoleAsOf(db, userC, after));
    expect(result?.role).toBe("manager");
  });

  it("resolves to nothing before any role was ever recorded", async () => {
    const before = new Date("2026-01-01T00:00:00Z");
    const result = await withTenantScope(appDb, tenantA, (db) => getRoleAsOf(db, userC, before));
    expect(result).toBeUndefined();
  });
});

describe("getRoleAsOf: manager -> cashier demotion", () => {
  const userE = randomUUID();
  const t1 = new Date("2026-05-01T00:00:00Z");
  const t2 = new Date("2026-05-10T00:00:00Z");

  beforeAll(async () => {
    await ownerDb
      .insertInto("User")
      .values({
        id: userE,
        tenant_id: tenantA,
        email: `access-${randomUUID()}@user-role.test`,
        password_hash: await hashPassword("irrelevant"),
        role: "manager",
      })
      .execute();
    await withTenantScope(appDb, tenantA, (db) =>
      db
        .insertInto("UserRole")
        .values([
          {
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: userE,
            role: "manager",
            effective_from: t1,
          },
          {
            id: randomUUID(),
            tenant_id: tenantA,
            user_id: userE,
            role: "cashier",
            effective_from: t2,
          },
        ])
        .execute(),
    );
  });

  afterAll(async () => {
    await ownerDb.deleteFrom("UserRole").where("user_id", "=", userE).execute();
    await ownerDb.deleteFrom("User").where("id", "=", userE).execute();
  });

  it("before the demotion, an Override made under the higher role still re-verifies against manager", async () => {
    const asOf = new Date("2026-05-05T00:00:00Z");
    const result = await withTenantScope(appDb, tenantA, (db) => getRoleAsOf(db, userE, asOf));
    expect(result?.role).toBe("manager");
  });

  it("exactly at the demotion, the lower role is already in force", async () => {
    const result = await withTenantScope(appDb, tenantA, (db) => getRoleAsOf(db, userE, t2));
    expect(result?.role).toBe("cashier");
  });

  it("strictly after the demotion, the lower role stays in force — the demotion does not retroactively invalidate the earlier window", async () => {
    const after = new Date("2026-05-15T00:00:00Z");
    const result = await withTenantScope(appDb, tenantA, (db) => getRoleAsOf(db, userE, after));
    expect(result?.role).toBe("cashier");
  });
});
