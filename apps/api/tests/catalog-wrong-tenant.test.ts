import { randomUUID } from "node:crypto";

import { hashPassword } from "backend/src/common/password.ts";
import { createDb } from "backend/src/db/client.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantA = randomUUID();
const tenantB = randomUUID();
const adminA = randomUUID();
const adminB = randomUUID();
const storeA = randomUUID();
const storeB = randomUUID();

let categoryA: string;
let categoryB: string;
let itemA: string;
let itemB: string;
let archivedCategoryB: string;
let archivedItemB: string;

beforeAll(async () => {
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "Catalog Probe A" },
      { id: tenantB, name: "Catalog Probe B" },
    ])
    .execute();
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: adminA,
        tenant_id: tenantA,
        email: `catalog-a-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: adminB,
        tenant_id: tenantB,
        email: `catalog-b-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "admin",
      },
    ])
    .execute();
  await ownerDb
    .insertInto("Store")
    .values([
      { id: storeA, tenant_id: tenantA, name: "A Store" },
      { id: storeB, tenant_id: tenantB, name: "B Store" },
    ])
    .execute();

  const clientA = seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client;
  const clientB = seam.actors.asTenant(tenantB, { userId: adminB, role: "admin" }).client;

  const createdCategoryA = await clientA.catalog.createCategory({ name: "A Ulam" });
  const createdCategoryB = await clientB.catalog.createCategory({ name: "B Ulam" });
  categoryA = createdCategoryA!.id;
  categoryB = createdCategoryB!.id;

  const createdItemA = await clientA.catalog.createMenuItem({
    categoryId: categoryA,
    name: "A Adobo",
  });
  const createdItemB = await clientB.catalog.createMenuItem({
    categoryId: categoryB,
    name: "B Adobo",
  });
  itemA = createdItemA!.id;
  itemB = createdItemB!.id;

  const extraCategoryB = await clientB.catalog.createCategory({ name: "B Archive Target" });
  archivedCategoryB = extraCategoryB!.id;
  await clientB.catalog.archiveCategory({ id: archivedCategoryB });

  const extraItemB = await clientB.catalog.createMenuItem({
    categoryId: categoryB,
    name: "B Archive Item",
  });
  archivedItemB = extraItemB!.id;
  await clientB.catalog.archiveMenuItem({ id: archivedItemB });
});

afterAll(async () => {
  await ownerDb.deleteFrom("Variant").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("MenuItem").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Category").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Store").where("id", "in", [storeA, storeB]).execute();
  await ownerDb.deleteFrom("User").where("id", "in", [adminA, adminB]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

const asA = () => seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client;
const asB = () => seam.actors.asTenant(tenantB, { userId: adminB, role: "admin" }).client;

describe("catalog wrong-tenant probes", () => {
  it("wrong-tenant probe [catalog.listCategories]: Tenant B's category is readable as B, never in A's list", async () => {
    const listAsB = await asB().catalog.listCategories();
    const ownAsB = listAsB.find((row) => row.id === categoryB);
    expect(ownAsB).toBeTruthy();

    const listAsA = await asA().catalog.listCategories();
    expect(listAsA.map((row) => row.id)).not.toContain(categoryB);
    const ownAsA = listAsA.find((row) => row.id === categoryA);
    expect(ownAsA).toBeTruthy();

    await expectWrongTenantRefusal({
      path: "catalog.listCategories",
      mode: "confined",
      ownerSees: ownAsB,
      otherGets: async () => ownAsA,
      otherOwn: ownAsA,
    });
  });

  it("wrong-tenant probe [catalog.listMenuItems]: Tenant B's menu item is readable as B, never in A's list", async () => {
    const listAsB = await asB().catalog.listMenuItems();
    const ownAsB = listAsB.find((row) => row.id === itemB);
    expect(ownAsB).toBeTruthy();

    const listAsA = await asA().catalog.listMenuItems();
    expect(listAsA.map((row) => row.id)).not.toContain(itemB);
    const ownAsA = listAsA.find((row) => row.id === itemA);
    expect(ownAsA).toBeTruthy();

    await expectWrongTenantRefusal({
      path: "catalog.listMenuItems",
      mode: "confined",
      ownerSees: ownAsB,
      otherGets: async () => ownAsA,
      otherOwn: ownAsA,
    });
  });

  it("wrong-tenant probe [catalog.createCategory]: each Tenant's create stays confined to its own tenant", async () => {
    const createdAsA = await asA().catalog.createCategory({ name: "A Probe Create" });
    const createdAsB = await asB().catalog.createCategory({ name: "B Probe Create" });
    expect(createdAsA).toBeTruthy();
    expect(createdAsB).toBeTruthy();

    const listAsA = await asA().catalog.listCategories();
    expect(listAsA.map((row) => row.id)).not.toContain(createdAsB!.id);

    await expectWrongTenantRefusal({
      path: "catalog.createCategory",
      mode: "confined",
      ownerSees: createdAsA,
      otherGets: async () => createdAsB,
      otherOwn: createdAsB,
    });
  });

  it("wrong-tenant probe [catalog.renameCategory]: Tenant A addressing Tenant B's category is refused", async () => {
    const beforeAsB = await asB().catalog.renameCategory({ id: categoryB, name: "B Ulam" });
    expect(beforeAsB?.name).toBe("B Ulam");

    await expectWrongTenantRefusal({
      path: "catalog.renameCategory",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.renameCategory({ id: categoryB, name: "Hijacked" }),
    });

    const afterAsB = (await asB().catalog.listCategories()).find((row) => row.id === categoryB);
    expect(afterAsB?.name).toBe("B Ulam");
  });

  it("wrong-tenant probe [catalog.archiveCategory]: Tenant A cannot archive Tenant B's category", async () => {
    const target = await asB().catalog.createCategory({ name: "B Archive Probe" });
    const beforeAsB = await asB().catalog.archiveCategory({ id: target!.id });
    expect(beforeAsB?.archivedAt).not.toBeNull();

    await expectWrongTenantRefusal({
      path: "catalog.archiveCategory",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.archiveCategory({ id: categoryB }),
    });

    const stillActive = (await asB().catalog.listCategories()).find((row) => row.id === categoryB);
    expect(stillActive?.archivedAt).toBeNull();
  });

  it("wrong-tenant probe [catalog.reactivateCategory]: Tenant A cannot reactivate Tenant B's category", async () => {
    const beforeAsB = await asB().catalog.reactivateCategory({ id: archivedCategoryB });
    expect(beforeAsB?.archivedAt).toBeNull();
    await asB().catalog.archiveCategory({ id: archivedCategoryB });

    await expectWrongTenantRefusal({
      path: "catalog.reactivateCategory",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.reactivateCategory({ id: archivedCategoryB }),
    });
  });

  it("wrong-tenant probe [catalog.reorderCategory]: Tenant A cannot reorder Tenant B's category", async () => {
    const beforeAsB = await asB().catalog.reorderCategory({ id: categoryB, direction: "up" });
    expect(beforeAsB).toBeTruthy();

    await expectWrongTenantRefusal({
      path: "catalog.reorderCategory",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.reorderCategory({ id: categoryB, direction: "down" }),
    });
  });

  it("wrong-tenant probe [catalog.createMenuItem]: Tenant A cannot create under Tenant B's category", async () => {
    const createdAsB = await asB().catalog.createMenuItem({
      categoryId: categoryB,
      name: "B Create Probe",
    });
    expect(createdAsB).toBeTruthy();

    await expectWrongTenantRefusal({
      path: "catalog.createMenuItem",
      mode: "refusal",
      ownerSees: createdAsB,
      otherGets: () =>
        asA().catalog.createMenuItem({ categoryId: categoryB, name: "Should Not Exist" }),
    });
  });

  it("wrong-tenant probe [catalog.renameMenuItem]: Tenant A addressing Tenant B's item is refused", async () => {
    const beforeAsB = await asB().catalog.renameMenuItem({ id: itemB, name: "B Adobo" });
    expect(beforeAsB?.name).toBe("B Adobo");

    await expectWrongTenantRefusal({
      path: "catalog.renameMenuItem",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.renameMenuItem({ id: itemB, name: "Hijacked" }),
    });
  });

  it("wrong-tenant probe [catalog.moveMenuItem]: Tenant A cannot move Tenant B's item", async () => {
    const otherCategoryB = await asB().catalog.createCategory({ name: "B Move Target" });
    const beforeAsB = await asB().catalog.moveMenuItem({
      id: itemB,
      categoryId: otherCategoryB!.id,
    });
    expect(beforeAsB?.categoryId).toBe(otherCategoryB!.id);
    await asB().catalog.moveMenuItem({ id: itemB, categoryId: categoryB });

    await expectWrongTenantRefusal({
      path: "catalog.moveMenuItem",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.moveMenuItem({ id: itemB, categoryId: categoryA }),
    });
  });

  it("wrong-tenant probe [catalog.archiveMenuItem]: Tenant A cannot archive Tenant B's item", async () => {
    const target = await asB().catalog.createMenuItem({
      categoryId: categoryB,
      name: "B Archive Item Probe",
    });
    const beforeAsB = await asB().catalog.archiveMenuItem({ id: target!.id });
    expect(beforeAsB?.archivedAt).not.toBeNull();

    await expectWrongTenantRefusal({
      path: "catalog.archiveMenuItem",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.archiveMenuItem({ id: itemB }),
    });
  });

  it("wrong-tenant probe [catalog.reactivateMenuItem]: Tenant A cannot reactivate Tenant B's item", async () => {
    const beforeAsB = await asB().catalog.reactivateMenuItem({ id: archivedItemB });
    expect(beforeAsB?.archivedAt).toBeNull();
    await asB().catalog.archiveMenuItem({ id: archivedItemB });

    await expectWrongTenantRefusal({
      path: "catalog.reactivateMenuItem",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.reactivateMenuItem({ id: archivedItemB }),
    });
  });

  it("wrong-tenant probe [catalog.reorderMenuItem]: Tenant A cannot reorder Tenant B's item", async () => {
    const second = await asB().catalog.createMenuItem({
      categoryId: categoryB,
      name: "B Reorder Peer",
    });
    expect(second).toBeTruthy();
    const beforeAsB = await asB().catalog.reorderMenuItem({ id: itemB, direction: "down" });
    expect(beforeAsB).toBeTruthy();

    await expectWrongTenantRefusal({
      path: "catalog.reorderMenuItem",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.reorderMenuItem({ id: itemB, direction: "up" }),
    });
  });

  it("wrong-tenant probe [catalog.read]: Tenant B's categories never appear in Tenant A's read", async () => {
    const readAsB = await asB().catalog.read({ storeId: storeB });
    expect(readAsB.categories.map((row) => row.id)).toContain(categoryB);
    const ownAsB = readAsB.categories.find((row) => row.id === categoryB);

    const readAsA = await asA().catalog.read({ storeId: storeA });
    expect(readAsA.categories.map((row) => row.id)).not.toContain(categoryB);
    const ownAsA = readAsA.categories.find((row) => row.id === categoryA);
    expect(ownAsA).toBeTruthy();

    await expectWrongTenantRefusal({
      path: "catalog.read",
      mode: "confined",
      ownerSees: ownAsB,
      otherGets: async () => ownAsA,
      otherOwn: ownAsA,
    });
  });

  it("wrong-tenant probe [catalog.version]: each Tenant's version stays confined to its own payload", async () => {
    const versionAsB = await asB().catalog.version({ storeId: storeB });
    const versionAsA = await asA().catalog.version({ storeId: storeA });
    expect(versionAsA.version).not.toBe(versionAsB.version);

    await expectWrongTenantRefusal({
      path: "catalog.version",
      mode: "confined",
      ownerSees: versionAsB,
      otherGets: async () => versionAsA,
      otherOwn: versionAsA,
    });
  });
});

describe("catalog variant wrong-tenant probes", () => {
  let variantA: string;
  let variantB: string;
  let archivedVariantB: string;

  beforeAll(async () => {
    const createdA = await asA().catalog.createVariant({
      menuItemId: itemA,
      name: "A Regular",
      priceCentavos: 10_000,
    });
    const createdB = await asB().catalog.createVariant({
      menuItemId: itemB,
      name: "B Regular",
      priceCentavos: 11_000,
    });
    variantA = createdA!.id;
    variantB = createdB!.id;
    const extraB = await asB().catalog.createVariant({
      menuItemId: itemB,
      name: "B Archive",
      priceCentavos: 12_000,
    });
    archivedVariantB = extraB!.id;
    await asB().catalog.archiveVariant({ id: archivedVariantB });
  });

  it("wrong-tenant probe [catalog.listVariants]: Tenant B's variants never appear in A's list", async () => {
    const listAsB = await asB().catalog.listVariants({ menuItemId: itemB });
    const ownAsB = listAsB.find((row) => row.id === variantB);
    expect(ownAsB).toBeTruthy();

    const listAsA = await asA().catalog.listVariants({ menuItemId: itemA });
    expect(listAsA.map((row) => row.id)).not.toContain(variantB);

    await expectWrongTenantRefusal({
      path: "catalog.listVariants",
      mode: "confined",
      ownerSees: ownAsB,
      otherGets: async () => listAsA.find((row) => row.id === variantA),
      otherOwn: listAsA.find((row) => row.id === variantA),
    });
  });

  it("wrong-tenant probe [catalog.getVariant]: Tenant A cannot read Tenant B's variant", async () => {
    const ownerSees = await asB().catalog.getVariant({ id: variantB });
    expect(ownerSees).toBeTruthy();
    await expectWrongTenantRefusal({
      path: "catalog.getVariant",
      mode: "refusal",
      ownerSees,
      otherGets: () => asA().catalog.getVariant({ id: variantB }),
    });
  });

  it("wrong-tenant probe [catalog.getMenuItem]: Tenant A cannot read Tenant B's menu item", async () => {
    const ownerSees = await asB().catalog.getMenuItem({ id: itemB });
    expect(ownerSees).toBeTruthy();
    await expectWrongTenantRefusal({
      path: "catalog.getMenuItem",
      mode: "refusal",
      ownerSees,
      otherGets: () => asA().catalog.getMenuItem({ id: itemB }),
    });
  });

  it("wrong-tenant probe [catalog.createVariant]: creates stay confined", async () => {
    const createdAsA = await asA().catalog.createVariant({
      menuItemId: itemA,
      name: "A Probe",
      priceCentavos: 1_000,
    });
    const createdAsB = await asB().catalog.createVariant({
      menuItemId: itemB,
      name: "B Probe",
      priceCentavos: 1_000,
    });
    expect(createdAsA).toBeTruthy();
    expect(createdAsB).toBeTruthy();
    const listAsA = await asA().catalog.listVariants({ menuItemId: itemA });
    expect(listAsA.map((row) => row.id)).not.toContain(createdAsB!.id);
    await expectWrongTenantRefusal({
      path: "catalog.createVariant",
      mode: "confined",
      ownerSees: createdAsA,
      otherGets: async () => createdAsB,
      otherOwn: createdAsB,
    });
  });

  it("wrong-tenant probe [catalog.renameVariant]: Tenant A cannot rename Tenant B's variant", async () => {
    const beforeAsB = await asB().catalog.renameVariant({ id: variantB, name: "B Regular" });
    await expectWrongTenantRefusal({
      path: "catalog.renameVariant",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.renameVariant({ id: variantB, name: "Hijacked" }),
    });
    const after = await asB().catalog.getVariant({ id: variantB });
    expect(after?.name).toBe("B Regular");
  });

  it("wrong-tenant probe [catalog.setVariantPrice]: Tenant A cannot reprice Tenant B's variant", async () => {
    const beforeAsB = await asB().catalog.setVariantPrice({ id: variantB, priceCentavos: 11_000 });
    await expectWrongTenantRefusal({
      path: "catalog.setVariantPrice",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.setVariantPrice({ id: variantB, priceCentavos: 1 }),
    });
    const after = await asB().catalog.getVariant({ id: variantB });
    expect(after?.priceCentavos).toBe(11_000);
  });

  it("wrong-tenant probe [catalog.archiveVariant]: Tenant A cannot archive Tenant B's variant", async () => {
    const target = await asB().catalog.createVariant({
      menuItemId: itemB,
      name: "B Archive Probe",
      priceCentavos: 3_000,
    });
    const beforeAsB = await asB().catalog.archiveVariant({ id: target!.id });
    expect(beforeAsB?.archivedAt).not.toBeNull();
    await expectWrongTenantRefusal({
      path: "catalog.archiveVariant",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.archiveVariant({ id: variantB }),
    });
    const still = await asB().catalog.getVariant({ id: variantB });
    expect(still?.archivedAt).toBeNull();
  });

  it("wrong-tenant probe [catalog.reactivateVariant]: Tenant A cannot reactivate Tenant B's variant", async () => {
    const beforeAsB = await asB().catalog.reactivateVariant({ id: archivedVariantB });
    expect(beforeAsB?.archivedAt).toBeNull();
    await asB().catalog.archiveVariant({ id: archivedVariantB });
    await expectWrongTenantRefusal({
      path: "catalog.reactivateVariant",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.reactivateVariant({ id: archivedVariantB }),
    });
    const still = await asB().catalog.getVariant({ id: archivedVariantB });
    expect(still?.archivedAt).not.toBeNull();
  });

  it("wrong-tenant probe [catalog.reorderVariant]: Tenant A cannot reorder Tenant B's variant", async () => {
    const beforeAsB = await asB().catalog.reorderVariant({ id: variantB, direction: "up" });
    await expectWrongTenantRefusal({
      path: "catalog.reorderVariant",
      mode: "refusal",
      ownerSees: beforeAsB,
      otherGets: () => asA().catalog.reorderVariant({ id: variantB, direction: "down" }),
    });
  });
});
