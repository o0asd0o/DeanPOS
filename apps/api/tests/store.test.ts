import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

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

  await withTenantScope(seam.db, tenantA, (db) =>
    db.insertInto("Store").values({ id: storeA, tenant_id: tenantA, name: "A's Store" }).execute(),
  );
  await withTenantScope(seam.db, tenantB, (db) =>
    db.insertInto("Store").values({ id: storeB, tenant_id: tenantB, name: "B's Store" }).execute(),
  );
});

afterAll(async () => {
  await ownerDb.deleteFrom("Store").where("id", "in", [storeA, storeB]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("store.get", () => {
  it("returns a Tenant's own Store, through contract → route → handler → query → Kysely", async () => {
    const store = await seam.actors.asTenant(tenantA).client.store.get({ id: storeA });

    expect(store?.id).toBe(storeA);
    expect(store?.tenantId).toBe(tenantA);
  });

  it("the wrong-tenant probe: Tenant A addressing Tenant B's Store id directly gets refused, never B's row", async () => {
    await expectWrongTenantRefusal(
      () => seam.actors.asTenant(tenantA).client.store.get({ id: storeB }),
      (result) => result === null,
    );
  });

  it("an unauthenticated caller reaches no Store at all", async () => {
    const store = await seam.actors.asUnauthenticated().client.store.get({ id: storeA });

    expect(store).toBeNull();
  });

  it("the app role cannot DELETE a Store — deactivated, never deleted (issue 01)", async () => {
    await expect(
      withTenantScope(seam.db, tenantA, (db) =>
        db.deleteFrom("Store").where("id", "=", storeA).execute(),
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});
