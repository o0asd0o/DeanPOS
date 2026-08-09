import { randomUUID } from "node:crypto";

import { hashPassword } from "backend/src/common/password.ts";
import { createDb } from "backend/src/db/client.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const tenantId = randomUUID();
const adminId = randomUUID();
const managerId = randomUUID();
const cashierId = randomUUID();
const storeId = randomUUID();

beforeAll(async () => {
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Variant Tenant" }).execute();
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: adminId,
        tenant_id: tenantId,
        email: `variant-admin-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: managerId,
        tenant_id: tenantId,
        email: `variant-mgr-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "manager",
      },
      {
        id: cashierId,
        tenant_id: tenantId,
        email: `variant-cash-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "cashier",
      },
    ])
    .execute();
  await ownerDb
    .insertInto("Store")
    .values({ id: storeId, tenant_id: tenantId, name: "Variant Store" })
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Variant").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("MenuItem").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Category").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("id", "=", storeId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

const asAdmin = () => seam.actors.asTenant(tenantId, { userId: adminId, role: "admin" }).client;
const asManager = () =>
  seam.actors.asTenant(tenantId, { userId: managerId, role: "manager" }).client;
const asCashier = () =>
  seam.actors.asTenant(tenantId, { userId: cashierId, role: "cashier" }).client;

async function seedItem(name = "Adobo") {
  const client = asAdmin();
  const category = await client.catalog.createCategory({ name: `Cat ${randomUUID().slice(0, 8)}` });
  const item = await client.catalog.createMenuItem({
    categoryId: category!.id,
    name,
    priceCentavos: 10000,
  });
  return { client, category: category!, item: item! };
}

describe("catalog variants + archive cascade (read model)", () => {
  it("includes a Variant price on the read model and the MenuItem base price", async () => {
    const { client, item } = await seedItem("Sinigang");
    const created = await client.catalog.createVariant({
      menuItemId: item.id,
      name: "Regular",
      priceCentavos: 12_000,
    });
    expect(created?.priceCentavos).toBe(12_000);
    expect(Number.isInteger(created?.priceCentavos)).toBe(true);

    const listed = await client.catalog.listMenuItems({});
    expect(listed.items.find((row) => row.id === item.id)?.priceCentavos).toBe(10000);

    const read = await client.catalog.read({ storeId });
    const onRead = read.menuItems.find((row) => row.id === item.id);
    expect(onRead?.variants).toStrictEqual([
      {
        id: created!.id,
        name: "Regular",
        priceCentavos: 12_000,
        sortOrder: 0,
        modifierGroups: [],
      },
    ]);
  });

  it("cascade row 1: archiving a Category removes its MenuItems and Variants from the read model", async () => {
    const { client, category, item } = await seedItem("Cascade Cat");
    await client.catalog.createVariant({
      menuItemId: item.id,
      name: "Bowl",
      priceCentavos: 15_000,
    });
    expect(
      (await client.catalog.read({ storeId })).menuItems.some((row) => row.id === item.id),
    ).toBe(true);

    await client.catalog.archiveCategory({ id: category.id });
    const read = await client.catalog.read({ storeId });
    expect(read.categories.map((row) => row.id)).not.toContain(category.id);
    expect(read.menuItems.map((row) => row.id)).not.toContain(item.id);
  });

  it("cascade row 2: archiving a MenuItem removes its Variants from the read model", async () => {
    const { client, item } = await seedItem("Cascade Item");
    const variant = await client.catalog.createVariant({
      menuItemId: item.id,
      name: "Half",
      priceCentavos: 8_000,
    });
    await client.catalog.archiveMenuItem({ id: item.id });
    const read = await client.catalog.read({ storeId });
    expect(read.menuItems.map((row) => row.id)).not.toContain(item.id);
    expect(read.menuItems.flatMap((row) => row.variants.map((entry) => entry.id))).not.toContain(
      variant!.id,
    );
  });

  it("cascade row 3: archiving a Variant leaves siblings; last Variant drops the MenuItem", async () => {
    const { client, item } = await seedItem("Cascade Variant");
    const first = await client.catalog.createVariant({
      menuItemId: item.id,
      name: "Small",
      priceCentavos: 10_000,
    });
    const second = await client.catalog.createVariant({
      menuItemId: item.id,
      name: "Large",
      priceCentavos: 14_000,
    });

    await client.catalog.archiveVariant({ id: first!.id });
    let read = await client.catalog.read({ storeId });
    const still = read.menuItems.find((row) => row.id === item.id);
    expect(still?.variants.map((entry) => entry.id)).toStrictEqual([second!.id]);

    await client.catalog.archiveVariant({ id: second!.id });
    read = await client.catalog.read({ storeId });
    expect(read.menuItems.map((row) => row.id)).not.toContain(item.id);

    const byId = await client.catalog.getVariant({ id: second!.id });
    expect(byId?.archivedAt).not.toBeNull();
    expect(byId?.id).toBe(second!.id);
  });

  it("un-archive Category restores only never-self-archived children (scenario 5)", async () => {
    const client = asAdmin();
    const category = await client.catalog.createCategory({
      name: `Unarch ${randomUUID().slice(0, 6)}`,
    });
    const kept = await client.catalog.createMenuItem({
      categoryId: category!.id,
      name: "Kept",
      priceCentavos: 10000,
    });
    const selfArchived = await client.catalog.createMenuItem({
      categoryId: category!.id,
      name: "Self archived",
      priceCentavos: 10000,
    });
    await client.catalog.createVariant({
      menuItemId: kept!.id,
      name: "Regular",
      priceCentavos: 11_000,
    });
    await client.catalog.createVariant({
      menuItemId: selfArchived!.id,
      name: "Regular",
      priceCentavos: 11_000,
    });

    await client.catalog.archiveMenuItem({ id: selfArchived!.id });
    await client.catalog.archiveCategory({ id: category!.id });
    await client.catalog.reactivateCategory({ id: category!.id });

    const read = await client.catalog.read({ storeId });
    const ids = read.menuItems.map((row) => row.id);
    expect(ids).toContain(kept!.id);
    expect(ids).not.toContain(selfArchived!.id);
  });

  it("un-archive Variant under archived MenuItem stays out of the read model (scenario 28)", async () => {
    const { client, item } = await seedItem("Parent archived");
    const variant = await client.catalog.createVariant({
      menuItemId: item.id,
      name: "Only",
      priceCentavos: 9_000,
    });
    await client.catalog.archiveMenuItem({ id: item.id });
    await client.catalog.reactivateVariant({ id: variant!.id });

    const byId = await client.catalog.getVariant({ id: variant!.id });
    expect(byId?.archivedAt).toBeNull();

    const read = await client.catalog.read({ storeId });
    expect(read.menuItems.map((row) => row.id)).not.toContain(item.id);
    expect(read.menuItems.flatMap((row) => row.variants.map((entry) => entry.id))).not.toContain(
      variant!.id,
    );
  });

  it("price change moves version; no-op save does not (scenario 11 / record 069)", async () => {
    const { client, item } = await seedItem("Versioned");
    const variant = await client.catalog.createVariant({
      menuItemId: item.id,
      name: "Cup",
      priceCentavos: 5_000,
    });
    const before = (await client.catalog.version({ storeId })).version;

    const noOp = await client.catalog.setVariantPrice({
      id: variant!.id,
      priceCentavos: 5_000,
    });
    expect(noOp?.priceCentavos).toBe(5_000);
    expect((await client.catalog.version({ storeId })).version).toBe(before);

    await client.catalog.setVariantPrice({ id: variant!.id, priceCentavos: 5_500 });
    const after = (await client.catalog.version({ storeId })).version;
    expect(after).not.toBe(before);
    expect(after).toMatch(/^[0-9a-f]{64}$/);
  });

  it("two rapid identical creates produce one Variant (scenario 24)", async () => {
    const { client, item } = await seedItem("Idempotent");
    const payload = {
      menuItemId: item.id,
      name: "Adobo",
      priceCentavos: 12_000,
    };
    const [a, b] = await Promise.all([
      client.catalog.createVariant(payload),
      client.catalog.createVariant(payload),
    ]);
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a!.id).toBe(b!.id);
    const list = await client.catalog.listVariants({ menuItemId: item.id });
    expect(list.filter((row) => row.id === a!.id && row.archivedAt === null)).toHaveLength(1);
  });

  it("manager can mutate; cashier cannot", async () => {
    const { item } = await seedItem("Roles");
    const managerCreated = await asManager().catalog.createVariant({
      menuItemId: item.id,
      name: "Mgr",
      priceCentavos: 7_000,
    });
    expect(managerCreated).toBeTruthy();

    const cashierCreated = await asCashier().catalog.createVariant({
      menuItemId: item.id,
      name: "Cash",
      priceCentavos: 7_000,
    });
    expect(cashierCreated).toBeNull();

    const cashierPrice = await asCashier().catalog.setVariantPrice({
      id: managerCreated!.id,
      priceCentavos: 1,
    });
    expect(cashierPrice).toBeNull();
  });

  it("reorders Variants with up/down neighbour swaps", async () => {
    const { client, item } = await seedItem("Reorder");
    const a = await client.catalog.createVariant({
      menuItemId: item.id,
      name: "A",
      priceCentavos: 1_000,
    });
    const b = await client.catalog.createVariant({
      menuItemId: item.id,
      name: "B",
      priceCentavos: 2_000,
    });
    await client.catalog.reorderVariant({ id: b!.id, direction: "up" });
    const list = (await client.catalog.listVariants({ menuItemId: item.id })).filter(
      (row) => row.archivedAt === null,
    );
    expect(list.map((row) => row.id)).toStrictEqual([b!.id, a!.id]);
  });
});
