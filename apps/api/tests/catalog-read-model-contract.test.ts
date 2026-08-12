import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { hashPassword } from "backend/src/common/password.ts";
import { createDb, sql } from "backend/src/db/client.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const tenantId = randomUUID();
const freshTenantId = randomUUID();
const adminId = randomUUID();
const cashierId = randomUUID();
const freshAdminId = randomUUID();
const storeA = randomUUID();
const storeB = randomUUID();
const freshStore = randomUUID();
const categoryId = randomUUID();
const itemId = randomUUID();
const stressItemId = randomUUID();

beforeAll(async () => {
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantId, name: "Read Model Contract" },
      { id: freshTenantId, name: "Fresh Read Model Contract" },
    ])
    .execute();
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: adminId,
        tenant_id: tenantId,
        email: `read-model-admin-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: cashierId,
        tenant_id: tenantId,
        email: `read-model-cashier-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "cashier",
      },
      {
        id: freshAdminId,
        tenant_id: freshTenantId,
        email: `read-model-fresh-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "admin",
      },
    ])
    .execute();
  await ownerDb
    .insertInto("Store")
    .values([
      { id: storeA, tenant_id: tenantId, name: "Contract A" },
      { id: storeB, tenant_id: tenantId, name: "Contract B" },
      { id: freshStore, tenant_id: freshTenantId, name: "Fresh Store" },
    ])
    .execute();
  await ownerDb
    .insertInto("UserStore")
    .values({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: cashierId,
      store_id: storeA,
      assigned: true,
      effective_from: new Date("2026-01-01T00:00:00Z"),
    })
    .execute();
  await ownerDb
    .insertInto("Category")
    .values({ id: categoryId, tenant_id: tenantId, name: "Contract", sort_order: 0 })
    .execute();
  await ownerDb
    .insertInto("MenuItem")
    .values({
      id: itemId,
      tenant_id: tenantId,
      category_id: categoryId,
      name: "Contract Item",
      price_centavos: 10000,
      sort_order: 0,
    })
    .execute();
  await ownerDb
    .insertInto("MenuItem")
    .values({
      id: stressItemId,
      tenant_id: tenantId,
      category_id: categoryId,
      name: "Stress Item",
      price_centavos: 10000,
      sort_order: 1,
    })
    .execute();
});

afterAll(async () => {
  for (const id of [tenantId, freshTenantId]) {
    await ownerDb.deleteFrom("MenuItemAddOn").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("MenuItemModifierGroup").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("VariantUnavailability").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("MenuItemUnavailability").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("Variant").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("MenuItem").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("Modifier").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("ModifierGroup").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("AddOn").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("Discount").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("DiscountAudit").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("Category").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("DeviceAudit").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("EnrolmentCode").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("Device").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("Store").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("User").where("tenant_id", "=", id).execute();
    await ownerDb.deleteFrom("Tenant").where("id", "=", id).execute();
  }
  await ownerDb.destroy();
  await seam.db.destroy();
});

const admin = () => seam.actors.asTenant(tenantId, { userId: adminId, role: "admin" }).client;
const cashier = () => seam.actors.asTenant(tenantId, { userId: cashierId, role: "cashier" }).client;

describe("catalog read-model contract: hash and forbidden fields", () => {
  it("AC4: the reported version hashes the delivered payload", async () => {
    const variant = await admin().catalog.createVariant({
      menuItemId: itemId,
      name: "Hash Variant",
      priceCentavos: 10000,
    });
    const read = await admin().catalog.read({ storeId: storeA });
    const canonical = JSON.stringify({
      categories: read.categories,
      menuItems: read.menuItems,
      discounts: read.discounts,
      paymentMethods: read.paymentMethods,
    });
    const result = await sql<{ version: string }>`
      select encode(sha256(convert_to(${canonical}::jsonb::text, 'UTF8')), 'hex') as version
    `.execute(ownerDb);
    expect(read.version).toBe(result.rows[0]!.version);
    expect((await admin().catalog.version({ storeId: storeA })).version).toBe(read.version);

    await admin().catalog.setVariantPrice({ id: variant!.id, priceCentavos: 10000 });
    const noOp = await admin().catalog.read({ storeId: storeA });
    expect(noOp.version).toBe(read.version);
    expect(noOp).toStrictEqual(read);
    await admin().catalog.setVariantPrice({ id: variant!.id, priceCentavos: 12000 });
    const duringChange = await admin().catalog.read({ storeId: storeA });
    expect(duringChange.version).not.toBe(read.version);
    expect(duringChange).not.toStrictEqual(read);
    await admin().catalog.setVariantPrice({ id: variant!.id, priceCentavos: 10000 });
    const restored = await admin().catalog.read({ storeId: storeA });
    expect(restored.version).toBe(read.version);
    expect(restored).toStrictEqual(read);
  });

  it("AC6: the payload builder and read schema contain no time or request fields", () => {
    const querySource = readFileSync(
      new URL(
        "../../../packages/backend/src/catalog/db-operations/queries/catalog-version.query.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const schemaSource = readFileSync(
      new URL("../../../packages/contract/src/routes/catalog/schemas.ts", import.meta.url),
      "utf8",
    );
    const payloadSource = querySource.slice(
      querySource.indexOf("jsonBuildObject({"),
      querySource.indexOf('}).as("content")'),
    );
    const readSchemaSource = schemaSource.slice(
      schemaSource.indexOf("export const catalogReadModifierSchema"),
      schemaSource.indexOf("export const catalogReadOutputSchema"),
    );
    for (const forbidden of ["now()", "created_at", "updated_at", "request_id", "transaction_"]) {
      expect(payloadSource).not.toContain(forbidden);
      expect(readSchemaSource).not.toContain(forbidden);
    }
  });
});

describe("catalog read-model contract: tenant-wide changes", () => {
  it("AC8: Discount, Add-on, and ModifierGroup changes move every Store version", async () => {
    const beforeDiscount = await Promise.all([
      admin().catalog.version({ storeId: storeA }),
      admin().catalog.version({ storeId: storeB }),
    ]);
    await admin().catalog.createDiscount({
      name: `Contract discount ${randomUUID()}`,
      type: "percent",
      scope: "order",
      value: 10,
      requiresOverride: false,
      vatExempt: false,
      requiresReference: false,
      referenceLabel: null,
    });
    const afterDiscount = await Promise.all([
      admin().catalog.version({ storeId: storeA }),
      admin().catalog.version({ storeId: storeB }),
    ]);
    expect(afterDiscount[0].version).not.toBe(beforeDiscount[0].version);
    expect(afterDiscount[1].version).not.toBe(beforeDiscount[1].version);

    const addOn = await admin().catalog.createAddOn({
      name: `Contract add-on ${randomUUID()}`,
      delta: { kind: "absolute", amountCentavos: 100 },
      maximum: 1,
    });
    await admin().catalog.linkAddOnToMenuItem({ menuItemId: itemId, addOnId: addOn!.id });
    const afterAddOn = await Promise.all([
      admin().catalog.version({ storeId: storeA }),
      admin().catalog.version({ storeId: storeB }),
    ]);
    expect(afterAddOn[0].version).not.toBe(afterDiscount[0].version);
    expect(afterAddOn[1].version).not.toBe(afterDiscount[1].version);

    const group = await admin().catalog.createModifierGroup({
      name: `Contract group ${randomUUID()}`,
      selectionRule: "optional-one",
      maximum: 1,
    });
    await admin().catalog.linkModifierGroupToMenuItem({
      menuItemId: itemId,
      modifierGroupId: group!.id,
    });
    const afterGroup = await Promise.all([
      admin().catalog.version({ storeId: storeA }),
      admin().catalog.version({ storeId: storeB }),
    ]);
    expect(afterGroup[0].version).not.toBe(afterAddOn[0].version);
    expect(afterGroup[1].version).not.toBe(afterAddOn[1].version);
  });
});

describe("catalog read-model contract: stress and access", () => {
  it("AC10: 400 Variants fit one bounded, unpaginated payload", async () => {
    const variants = Array.from({ length: 400 }, (_, index) => ({
      id: randomUUID(),
      tenant_id: tenantId,
      menu_item_id: stressItemId,
      name: `Stress Variant ${index.toString().padStart(3, "0")}`,
      price_centavos: 10000 + index,
      sort_order: index,
    }));
    await ownerDb.insertInto("Variant").values(variants).execute();
    const read = await admin().catalog.read({ storeId: storeA });
    const serializedLength = JSON.stringify(read).length;
    const MAX_READ_MODEL_BYTES = 200_000; // Scenario 9: phone-tether bound for 400 Variants.
    expect(read.menuItems.find((item) => item.id === stressItemId)?.variants).toHaveLength(400);
    expect(serializedLength).toBeLessThan(MAX_READ_MODEL_BYTES);
  });

  it("AC11: a fresh Device reads an empty catalog", async () => {
    const generated = await seam.actors
      .asTenant(freshTenantId, { userId: freshAdminId, role: "admin" })
      .client.device.generateCode({ storeId: freshStore, name: "Fresh device", code: "FR" });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const enrolled = await seam.client.terminal.enrol({ secret: generated.secret });
    expect(enrolled.ok).toBe(true);
    if (!enrolled.ok) return;
    const read = await seam.actors.withBearerToken(enrolled.token).catalog.read({
      storeId: freshStore,
    });
    expect(read.categories).toStrictEqual([]);
    expect(read.menuItems).toStrictEqual([]);
    expect(read.discounts).toStrictEqual([]);
  });

  it("AC13: a cashier reads but cannot mutate, and a Device cannot mutate", async () => {
    const cashierRead = await cashier().catalog.read({ storeId: storeA });
    expect(cashierRead.version).toMatch(/^[0-9a-f]{64}$/);
    expect(await cashier().catalog.createCategory({ name: "Cashier blocked" })).toBeNull();

    const generated = await admin().device.generateCode({
      storeId: storeA,
      name: "Contract device",
      code: "CR",
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const enrolled = await seam.client.terminal.enrol({ secret: generated.secret });
    expect(enrolled.ok).toBe(true);
    if (!enrolled.ok) return;
    const device = seam.actors.withBearerToken(enrolled.token);
    const deviceRead = await device.catalog.read({ storeId: storeA });
    expect(deviceRead.version).toMatch(/^[0-9a-f]{64}$/);
    expect(await device.catalog.createCategory({ name: "Device blocked" })).toBeNull();
  });
});
