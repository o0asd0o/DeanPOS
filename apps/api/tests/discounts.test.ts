import { randomUUID } from "node:crypto";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const tenantA = randomUUID();
const tenantB = randomUUID();
const adminA = randomUUID();
const adminB = randomUUID();
let discountB: string;

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "Discount Tenant A" },
      { id: tenantB, name: "Discount Tenant B" },
    ])
    .execute();
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: adminA,
        tenant_id: tenantA,
        email: `discount-a-${randomUUID()}@test`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: adminB,
        tenant_id: tenantB,
        email: `discount-b-${randomUUID()}@test`,
        password_hash: passwordHash,
        role: "admin",
      },
    ])
    .execute();
  const created = await asB().catalog.createDiscount({
    name: "B Senior",
    type: "percent",
    value: 10000,
    scope: "order",
    requiresOverride: true,
    vatExempt: true,
    requiresReference: true,
    referenceLabel: "ID number",
  });
  expect(created).toBeTruthy();
  discountB = created!.discountId;
  const own = await asA().catalog.createDiscount({
    name: "A Senior",
    type: "percent",
    value: 10000,
    scope: "order",
    requiresOverride: true,
    vatExempt: false,
    requiresReference: false,
    referenceLabel: null,
  });
  expect(own).toBeTruthy();
});

afterAll(async () => {
  await ownerDb.deleteFrom("DiscountAudit").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("Discount").where("tenant_id", "in", [tenantA, tenantB]).execute();
  await ownerDb.deleteFrom("User").where("id", "in", [adminA, adminB]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantA, tenantB]).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

const asA = () => seam.actors.asTenant(tenantA, { userId: adminA, role: "admin" }).client;
const asB = () => seam.actors.asTenant(tenantB, { userId: adminB, role: "admin" }).client;

describe("discount wrong-tenant probes", () => {
  it("wrong-tenant probe [catalog.listDiscounts]: Tenant A cannot read Tenant B's list", async () => {
    const owner = await asB().catalog.listDiscounts();
    const otherOwn = await asA().catalog.listDiscounts();
    await expectWrongTenantRefusal({
      path: "catalog.listDiscounts",
      mode: "confined",
      ownerSees: owner,
      otherGets: () => asA().catalog.listDiscounts(),
      otherOwn,
    });
  });

  it("wrong-tenant probe [catalog.createDiscount]: Tenant A's create stays in Tenant A", async () => {
    const owner = await asB().catalog.listDiscounts();
    const created = await asA().catalog.createDiscount({
      name: "A create",
      type: "percent",
      value: 100,
      scope: "order",
      requiresOverride: true,
      vatExempt: false,
      requiresReference: false,
      referenceLabel: null,
    });
    expect(created?.tenantId).toBe(tenantA);
    const own = await asA().catalog.listDiscounts();
    await expectWrongTenantRefusal({
      path: "catalog.createDiscount",
      mode: "confined",
      ownerSees: owner,
      otherGets: () => asA().catalog.listDiscounts(),
      otherOwn: own,
    });
  });

  it("wrong-tenant probe [catalog.updateDiscount]: Tenant A cannot edit Tenant B's lineage", async () => {
    const owner = (await asB().catalog.listDiscounts())[0];
    await expectWrongTenantRefusal({
      path: "catalog.updateDiscount",
      mode: "refusal",
      ownerSees: owner,
      otherGets: () =>
        asA().catalog.updateDiscount({
          id: discountB,
          name: "stolen",
          type: "percent",
          value: 100,
          scope: "order",
          requiresOverride: true,
          vatExempt: false,
          requiresReference: false,
          referenceLabel: null,
        }),
    });
  });

  it("wrong-tenant probe [catalog.archiveDiscount]: Tenant A cannot archive Tenant B's lineage", async () => {
    const owner = (await asB().catalog.listDiscounts())[0];
    await expectWrongTenantRefusal({
      path: "catalog.archiveDiscount",
      mode: "refusal",
      ownerSees: owner,
      otherGets: () => asA().catalog.archiveDiscount({ id: discountB }),
    });
  });

  it("wrong-tenant probe [catalog.reactivateDiscount]: Tenant A cannot reactivate Tenant B's lineage", async () => {
    await asB().catalog.archiveDiscount({ id: discountB });
    const owner = (await asB().catalog.listDiscounts()).find(
      (discount) => discount.discountId === discountB,
    );
    await expectWrongTenantRefusal({
      path: "catalog.reactivateDiscount",
      mode: "refusal",
      ownerSees: owner,
      otherGets: () => asA().catalog.reactivateDiscount({ id: discountB }),
    });
  });
});
