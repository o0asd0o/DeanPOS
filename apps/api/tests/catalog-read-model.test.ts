import { randomUUID } from "node:crypto";

import { hashPassword } from "backend/src/common/password.ts";
import { createDb } from "backend/src/db/client.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const tenantId = randomUUID();
const adminId = randomUUID();
const storeId = randomUUID();

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Catalog Tenant" }).execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: adminId,
      tenant_id: tenantId,
      email: `catalog-${randomUUID()}@test.local`,
      password_hash: await hashPassword("irrelevant"),
      role: "admin",
    })
    .execute();
  await ownerDb
    .insertInto("Store")
    .values({ id: storeId, tenant_id: tenantId, name: "Catalog Store" })
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Variant").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("MenuItem").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Category").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("id", "=", storeId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", adminId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("catalog.read", () => {
  it("keeps empty categories, excludes drafts, and agrees with catalog.version", async () => {
    const client = seam.actors.asTenant(tenantId, {
      userId: adminId,
      role: "admin",
    }).client;
    const category = await client.catalog.createCategory({ name: "Ulam" });
    const item = await client.catalog.createMenuItem({
      categoryId: category!.id,
      name: "Adobo",
    });

    const read = await client.catalog.read({ storeId });
    const version = await client.catalog.version({ storeId });

    expect(read.categories.map((entry) => entry.name)).toStrictEqual(["Ulam"]);
    expect(read.menuItems).toStrictEqual([]);
    expect(version.version).toBe(read.version);

    const renamed = await client.catalog.renameMenuItem({
      id: item!.id,
      name: "Adobo",
    });
    expect(renamed?.name).toBe("Adobo");
    expect((await client.catalog.version({ storeId })).version).toBe(version.version);
  });
});
