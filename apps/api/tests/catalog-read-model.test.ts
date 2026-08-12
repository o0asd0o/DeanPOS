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
const cashMethodId = randomUUID();
const gcashMethodId = randomUUID();
const cardMethodId = randomUUID();
const inactiveMethodId = randomUUID();

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
  await ownerDb
    .insertInto("PaymentMethod")
    .values([
      { id: cashMethodId, tenant_id: tenantId, name: "Cash", kind: "cash" },
      { id: gcashMethodId, tenant_id: tenantId, name: "GCash", kind: "recorded" },
      { id: cardMethodId, tenant_id: tenantId, name: "Card", kind: "recorded" },
      { id: inactiveMethodId, tenant_id: tenantId, name: "Maya", kind: "recorded", active: false },
    ])
    .execute();
  await ownerDb
    .insertInto("PaymentMethodAvailability")
    .values([
      {
        id: randomUUID(),
        tenant_id: tenantId,
        payment_method_id: gcashMethodId,
        store_id: storeId,
      },
      {
        id: randomUUID(),
        tenant_id: tenantId,
        payment_method_id: inactiveMethodId,
        store_id: storeId,
      },
    ])
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Variant").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("MenuItem").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Category").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("PaymentMethodAvailability").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("PaymentMethod").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("id", "=", storeId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", adminId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("catalog.read", () => {
  it("returns a filtered category as a server page", async () => {
    const client = seam.actors.asTenant(tenantId, {
      userId: adminId,
      role: "admin",
    }).client;
    const category = await client.catalog.createCategory({ name: `Paged ${randomUUID()}` });
    const otherCategory = await client.catalog.createCategory({ name: `Other ${randomUUID()}` });

    for (const name of ["Gamma", "Alpha", "Beta"]) {
      await client.catalog.createMenuItem({
        categoryId: category!.id,
        name,
        priceCentavos: 10_000,
      });
    }
    await client.catalog.createMenuItem({
      categoryId: otherCategory!.id,
      name: "Excluded",
      priceCentavos: 10_000,
    });

    const page = await client.catalog.listMenuItems({
      categoryId: category!.id,
      page: 2,
      perPage: 2,
      sort: { key: "name", direction: "asc" },
    });

    expect(page.items.map((item) => item.name)).toStrictEqual(["Gamma"]);
    expect(page).toMatchObject({
      count: 3,
      page: 2,
      perPage: 2,
      hasNextPage: false,
      hasPrevPage: true,
      totalCount: 3,
      activeCount: 3,
      liveCount: 0,
    });

    await ownerDb
      .deleteFrom("MenuItem")
      .where("category_id", "in", [category!.id, otherCategory!.id])
      .execute();
    await ownerDb
      .deleteFrom("Category")
      .where("id", "in", [category!.id, otherCategory!.id])
      .execute();
  });

  it("keeps empty categories, excludes drafts, and agrees with catalog.version", async () => {
    const client = seam.actors.asTenant(tenantId, {
      userId: adminId,
      role: "admin",
    }).client;
    const category = await client.catalog.createCategory({ name: "Ulam" });
    const item = await client.catalog.createMenuItem({
      categoryId: category!.id,
      name: "Adobo",
      priceCentavos: 10000,
    });

    const read = await client.catalog.read({ storeId });
    const version = await client.catalog.version({ storeId });

    expect(read.categories.map((entry) => entry.name)).toStrictEqual(["Ulam"]);
    expect(read.menuItems).toHaveLength(1);
    expect(read.menuItems[0]).toMatchObject({
      id: item!.id,
      variants: [],
      modifierGroups: [],
      addOns: [],
      available: true,
    });
    expect(read.paymentMethods).toStrictEqual([
      { id: cashMethodId, name: "Cash", kind: "cash" },
      { id: gcashMethodId, name: "GCash", kind: "recorded" },
    ]);
    expect(version.version).toBe(read.version);

    const renamed = await client.catalog.renameMenuItem({
      id: item!.id,
      name: "Adobo",
    });
    expect(renamed?.name).toBe("Adobo");
    expect((await client.catalog.version({ storeId })).version).toBe(version.version);
  });

  it("includes the Tenant VAT setting and moves the catalog version when it changes", async () => {
    const client = seam.actors.asTenant(tenantId, {
      userId: adminId,
      role: "admin",
    }).client;
    const vatOff = await client.catalog.read({ storeId });
    expect(vatOff).toMatchObject({ vatEnabled: false, vatRatePercent: 12 });

    await ownerDb
      .updateTable("Tenant")
      .set({ vat_enabled: true, vat_rate_percent: 7 })
      .where("id", "=", tenantId)
      .execute();

    const vatOn = await client.catalog.read({ storeId });
    expect(vatOn).toMatchObject({ vatEnabled: true, vatRatePercent: 7 });
    expect(vatOn.version).not.toBe(vatOff.version);

    await ownerDb
      .updateTable("Tenant")
      .set({ vat_enabled: false, vat_rate_percent: 12 })
      .where("id", "=", tenantId)
      .execute();
  });
});
