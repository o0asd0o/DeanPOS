import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb, type DatabaseInstance, withTenantScope } from "../../src/db/client.ts";

// The migration owner seeds fixtures directly. Tenant carries own-row-only
// SELECT/UPDATE policies for the app role, never a cross-tenant one
// (record 047). The app role is what `withTenantScope` is exercised
// against, matching production.
const ownerDb: DatabaseInstance = createDb({ databaseUrl: process.env.DATABASE_URI! });
const appDb: DatabaseInstance = createDb({ databaseUrl: process.env.APP_DATABASE_URI! });

const tenantA = randomUUID();
const tenantB = randomUUID();
const storeA = randomUUID();
const storeB = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "Tenant A" },
      { id: tenantB, name: "Tenant B" },
    ])
    .execute();

  await withTenantScope(appDb, tenantA, (db) =>
    db.insertInto("Store").values({ id: storeA, tenant_id: tenantA, name: "A's Store" }).execute(),
  );
  await withTenantScope(appDb, tenantB, (db) =>
    db.insertInto("Store").values({ id: storeB, tenant_id: tenantB, name: "B's Store" }).execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("Store").where("id", "in", [storeA, storeB]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await appDb.destroy();
});

describe("withTenantScope", () => {
  it("scopes a query to the tenant it was opened with", async () => {
    const rows = await withTenantScope(appDb, tenantA, (db) =>
      db.selectFrom("Store").selectAll().execute(),
    );

    expect(rows.map((r) => r.id)).toStrictEqual([storeA]);
  });

  it("never returns another tenant's rows even when addressed directly by id", async () => {
    const rows = await withTenantScope(appDb, tenantA, (db) =>
      db.selectFrom("Store").selectAll().where("id", "=", storeB).execute(),
    );

    expect(rows).toStrictEqual([]);
  });

  it("RLS denies by default rather than the repository filtering — no tenant set, rows exist, zero returned", async () => {
    const rows = await withTenantScope(appDb, null, (db) =>
      db.selectFrom("Store").selectAll().execute(),
    );

    expect(rows).toStrictEqual([]);
  });

  it("issuing the same unscoped query straight through the pool, with no transaction at all, also returns nothing", async () => {
    const rows = await appDb.selectFrom("Store").selectAll().execute();

    expect(rows).toStrictEqual([]);
  });

  it("a connection returned to the pool after scoping to a tenant carries no tenant into the next request", async () => {
    await withTenantScope(appDb, tenantA, (db) => db.selectFrom("Store").selectAll().execute());

    const rows = await withTenantScope(appDb, null, (db) =>
      db.selectFrom("Store").selectAll().execute(),
    );

    expect(rows).toStrictEqual([]);
  });

  it("a tenant-scoped connection reading Tenant sees exactly one row, its own", async () => {
    const rows = await withTenantScope(appDb, tenantA, (db) =>
      db.selectFrom("Tenant").selectAll().execute(),
    );

    expect(rows.map((r) => r.id)).toStrictEqual([tenantA]);
  });

  it("another tenant's row is invisible, including when addressed directly by id (record 047)", async () => {
    // Prove it exists and is readable elsewhere first (this repo's probe
    // discipline) — a bare empty-result assertion proves nothing.
    const asB = await withTenantScope(appDb, tenantB, (db) =>
      db.selectFrom("Tenant").selectAll().where("id", "=", tenantB).execute(),
    );
    expect(asB.map((r) => r.id)).toStrictEqual([tenantB]);

    const asA = await withTenantScope(appDb, tenantA, (db) =>
      db.selectFrom("Tenant").selectAll().where("id", "=", tenantB).execute(),
    );
    expect(asA).toStrictEqual([]);
  });

  it("a connection with no tenant scope set reads zero Tenant rows", async () => {
    const rows = await withTenantScope(appDb, null, (db) =>
      db.selectFrom("Tenant").selectAll().execute(),
    );

    expect(rows).toStrictEqual([]);
  });

  it("deanpos_app holds no DELETE on Tenant, and an UPDATE cannot move a row to another tenant", async () => {
    await expect(
      withTenantScope(appDb, tenantA, (db) =>
        db.deleteFrom("Tenant").where("id", "=", tenantA).execute(),
      ),
    ).rejects.toThrow(/permission denied/);

    await expect(
      withTenantScope(appDb, tenantA, (db) =>
        db.updateTable("Tenant").set({ id: tenantB }).where("id", "=", tenantA).execute(),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
