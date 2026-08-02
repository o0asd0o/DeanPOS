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

describe("UserRole and UserStore: RLS, not application filtering", () => {
  it("a tenant-scoped connection cannot read another Tenant's UserRole or UserStore rows", async () => {
    const roles = await withTenantScope(appDb, tenantB, (db) =>
      db.selectFrom("UserRole").selectAll().execute(),
    );
    const stores = await withTenantScope(appDb, tenantB, (db) =>
      db.selectFrom("UserStore").selectAll().execute(),
    );
    expect(roles).toStrictEqual([]);
    expect(stores).toStrictEqual([]);
  });

  it("an unscoped connection issuing the same selects directly sees nothing", async () => {
    expect(await appDb.selectFrom("UserRole").selectAll().execute()).toStrictEqual([]);
    expect(await appDb.selectFrom("UserStore").selectAll().execute()).toStrictEqual([]);
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

  it("resolves to the role in force on or after the change", async () => {
    const result = await withTenantScope(appDb, tenantA, (db) => getRoleAsOf(db, userC, t2));
    expect(result?.role).toBe("manager");
  });

  it("resolves to nothing before any role was ever recorded", async () => {
    const before = new Date("2026-01-01T00:00:00Z");
    const result = await withTenantScope(appDb, tenantA, (db) => getRoleAsOf(db, userC, before));
    expect(result).toBeUndefined();
  });
});
