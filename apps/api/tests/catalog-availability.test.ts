import { randomUUID } from "node:crypto";

import { hashPassword } from "backend/src/common/password.ts";
import { createDb } from "backend/src/db/client.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const tenantId = randomUUID();
const otherTenantId = randomUUID();
const adminId = randomUUID();
const otherAdminId = randomUUID();
const cashierId = randomUUID();
const storeA = randomUUID();
const storeB = randomUUID();
let itemId = "";
let variantId = "";

beforeAll(async () => {
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Availability Test" }).execute();
  await ownerDb
    .insertInto("Tenant")
    .values({ id: otherTenantId, name: "Other Availability Test" })
    .execute();
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: adminId,
        tenant_id: tenantId,
        email: `availability-admin-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: cashierId,
        tenant_id: tenantId,
        email: `availability-cashier-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "cashier",
      },
    ])
    .execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: otherAdminId,
      tenant_id: otherTenantId,
      email: `availability-other-${randomUUID()}@test.local`,
      password_hash: passwordHash,
      role: "admin",
    })
    .execute();
  await ownerDb
    .insertInto("Store")
    .values([
      { id: storeA, tenant_id: tenantId, name: "Availability A" },
      { id: storeB, tenant_id: tenantId, name: "Availability B" },
    ])
    .execute();
  const client = seam.actors.asTenant(tenantId, { userId: adminId, role: "admin" }).client;
  const category = await client.catalog.createCategory({ name: "Availability" });
  const item = await client.catalog.createMenuItem({
    categoryId: category!.id,
    name: "Adobo",
    priceCentavos: 10000,
  });
  itemId = item!.id;
  const variant = await client.catalog.createVariant({
    menuItemId: itemId,
    name: "Regular",
    priceCentavos: 10000,
  });
  variantId = variant!.id;
});

afterAll(async () => {
  await ownerDb.deleteFrom("MenuItemUnavailability").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("VariantUnavailability").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Variant").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("MenuItem").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Category").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", otherTenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", otherTenantId).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

const admin = () => seam.actors.asTenant(tenantId, { userId: adminId, role: "admin" }).client;
const cashier = () => seam.actors.asTenant(tenantId, { userId: cashierId, role: "cashier" }).client;
const otherAdmin = () =>
  seam.actors.asTenant(otherTenantId, { userId: otherAdminId, role: "admin" }).client;

describe("availability", () => {
  it("lists MenuItems and Variants as available by default", async () => {
    const page = await admin().availability.list({ storeId: storeA });
    expect(page.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "menuItem", id: itemId, available: true }),
        expect.objectContaining({ kind: "variant", id: variantId, available: true }),
      ]),
    );
    const secondStorePage = await admin().availability.list({ storeId: storeB });
    expect(secondStorePage.items.map((row) => row.id)).toEqual(
      expect.arrayContaining([itemId, variantId]),
    );
  });

  it("toggles both levels, scopes versions per Store, and is idempotent", async () => {
    const beforeA = await admin().catalog.version({ storeId: storeA });
    const beforeB = await admin().catalog.version({ storeId: storeB });
    const off = await admin().availability.set({
      storeId: storeA,
      changes: [
        { target: { kind: "variant", id: variantId }, available: false },
        { target: { kind: "menuItem", id: itemId }, available: false },
      ],
    });
    expect(off?.version).not.toBe(beforeA.version);
    expect((await admin().catalog.version({ storeId: storeB })).version).toBe(beforeB.version);
    const read = await admin().catalog.read({ storeId: storeA });
    expect(read.menuItems[0]?.available).toBe(false);
    expect(read.menuItems[0]?.variants[0]?.available).toBe(false);
    expect(
      (
        await admin().availability.set({
          storeId: storeA,
          changes: [
            { target: { kind: "variant", id: variantId }, available: false },
            { target: { kind: "menuItem", id: itemId }, available: false },
          ],
        })
      )?.version,
    ).toBe(off?.version);
    const on = await admin().availability.set({
      storeId: storeA,
      changes: [
        { target: { kind: "variant", id: variantId }, available: true },
        { target: { kind: "menuItem", id: itemId }, available: true },
      ],
    });
    expect(on?.version).toBe(beforeA.version);
  });

  it("refuses cashier writes and foreign Stores", async () => {
    expect(await cashier().availability.set({ storeId: storeA, changes: [] })).toBeNull();
    expect(await admin().availability.set({ storeId: randomUUID(), changes: [] })).toBeNull();
  });

  it("confines both availability procedures to the caller's Tenant", async () => {
    const list = await otherAdmin().availability.list({ storeId: storeA });
    expect(list.items).toStrictEqual([]);
    expect(await otherAdmin().availability.set({ storeId: storeA, changes: [] })).toBeNull();
  });
});
