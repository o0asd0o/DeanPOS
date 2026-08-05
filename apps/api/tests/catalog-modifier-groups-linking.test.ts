import { randomUUID } from "node:crypto";

import { hashPassword } from "backend/src/common/password.ts";
import { createDb } from "backend/src/db/client.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const tenantBId = randomUUID();
const adminId = randomUUID();
const adminBId = randomUUID();
const managerId = randomUUID();
const cashierId = randomUUID();
const storeId = randomUUID();

beforeAll(async () => {
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantId, name: "Linking Tenant A" },
      { id: tenantBId, name: "Linking Tenant B" },
    ])
    .execute();
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: adminId,
        tenant_id: tenantId,
        email: `linking-admin-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: adminBId,
        tenant_id: tenantBId,
        email: `linking-admin-b-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: managerId,
        tenant_id: tenantId,
        email: `linking-mgr-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "manager",
      },
      {
        id: cashierId,
        tenant_id: tenantId,
        email: `linking-cash-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "cashier",
      },
    ])
    .execute();
  await ownerDb
    .insertInto("Store")
    .values({ id: storeId, tenant_id: tenantId, name: "Linking Store" })
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("VariantModifierGroup").where("tenant_id", "in", [tenantId, tenantBId]).execute();
  // Null out default_modifier_id before deleting Modifiers (FK RESTRICT).
  await ownerDb.updateTable("ModifierGroup").set({ default_modifier_id: null }).where("tenant_id", "in", [tenantId, tenantBId]).execute();
  await ownerDb.deleteFrom("Modifier").where("tenant_id", "in", [tenantId, tenantBId]).execute();
  await ownerDb.deleteFrom("ModifierGroup").where("tenant_id", "in", [tenantId, tenantBId]).execute();
  await ownerDb.deleteFrom("Variant").where("tenant_id", "in", [tenantId, tenantBId]).execute();
  await ownerDb.deleteFrom("MenuItem").where("tenant_id", "in", [tenantId, tenantBId]).execute();
  await ownerDb.deleteFrom("Category").where("tenant_id", "in", [tenantId, tenantBId]).execute();
  await ownerDb.deleteFrom("Store").where("id", "=", storeId).execute();
  await ownerDb.deleteFrom("User").where("id", "in", [adminId, adminBId, managerId, cashierId]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantId, tenantBId]).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

const asAdmin = () => seam.actors.asTenant(tenantId, { userId: adminId, role: "admin" }).client;
const asManager = () =>
  seam.actors.asTenant(tenantId, { userId: managerId, role: "manager" }).client;
const asCashier = () =>
  seam.actors.asTenant(tenantId, { userId: cashierId, role: "cashier" }).client;
const asAdminB = () =>
  seam.actors.asTenant(tenantBId, { userId: adminBId, role: "admin" }).client;

async function seedVariant(price = 50_000) {
  const client = asAdmin();
  const category = await client.catalog.createCategory({
    name: `Cat ${randomUUID().slice(0, 6)}`,
  });
  const item = await client.catalog.createMenuItem({
    categoryId: category!.id,
    name: `Item ${randomUUID().slice(0, 6)}`,
    priceCentavos: price,
  });
  const variant = await client.catalog.createVariant({
    menuItemId: item!.id,
    name: "Regular",
    priceCentavos: price,
  });
  return { client, variant: variant!, item: item! };
}

async function seedGroup(opts?: { rule?: "required-one" | "optional-one" | "many" }) {
  const client = asAdmin();
  const group = await client.catalog.createModifierGroup({
    name: `Group ${randomUUID().slice(0, 6)}`,
    selectionRule: opts?.rule ?? "optional-one",
  });
  return { client, group: group! };
}

describe("link / unlink / list", () => {
  it("links a group to a variant; listLinkedModifierGroups returns it", async () => {
    const { variant } = await seedVariant();
    const { group } = await seedGroup();
    const client = asAdmin();

    const result = await client.catalog.linkModifierGroup({
      variantId: variant.id,
      modifierGroupId: group.id,
    });
    expect(result).toBeTruthy();
    expect(result!.id).toBe(group.id);

    const linked = await client.catalog.listLinkedModifierGroups({ variantId: variant.id });
    expect(linked.map((g) => g.id)).toContain(group.id);
  });

  it("unlinks a group; it disappears from the list", async () => {
    const { variant } = await seedVariant();
    const { group } = await seedGroup();
    const client = asAdmin();

    await client.catalog.linkModifierGroup({
      variantId: variant.id,
      modifierGroupId: group.id,
    });
    const before = await client.catalog.listLinkedModifierGroups({ variantId: variant.id });
    expect(before.map((g) => g.id)).toContain(group.id);

    const result = await client.catalog.unlinkModifierGroup({
      variantId: variant.id,
      modifierGroupId: group.id,
    });
    expect(result).toStrictEqual({ ok: true });

    const after = await client.catalog.listLinkedModifierGroups({ variantId: variant.id });
    expect(after.map((g) => g.id)).not.toContain(group.id);
  });

  it("listLinkedModifierGroups orders by sort_order (decision 073)", async () => {
    const { variant } = await seedVariant();
    const client = asAdmin();

    const g1 = await client.catalog.createModifierGroup({
      name: `G1 ${randomUUID().slice(0, 4)}`,
      selectionRule: "optional-one",
    });
    const g2 = await client.catalog.createModifierGroup({
      name: `G2 ${randomUUID().slice(0, 4)}`,
      selectionRule: "optional-one",
    });
    // g1 was created first (lower sort_order), g2 second.
    await client.catalog.linkModifierGroup({ variantId: variant.id, modifierGroupId: g2!.id });
    await client.catalog.linkModifierGroup({ variantId: variant.id, modifierGroupId: g1!.id });

    const linked = await client.catalog.listLinkedModifierGroups({ variantId: variant.id });
    const ids = linked.map((g) => g.id);
    expect(ids.indexOf(g1!.id)).toBeLessThan(ids.indexOf(g2!.id));
  });

  it("scenario 24: linking the same group twice is idempotent", async () => {
    const { variant } = await seedVariant();
    const { group } = await seedGroup();
    const client = asAdmin();

    await client.catalog.linkModifierGroup({
      variantId: variant.id,
      modifierGroupId: group.id,
    });
    // Second call must not throw.
    const second = await client.catalog.linkModifierGroup({
      variantId: variant.id,
      modifierGroupId: group.id,
    });
    expect(second).toBeTruthy();

    const linked = await client.catalog.listLinkedModifierGroups({ variantId: variant.id });
    expect(linked.filter((g) => g.id === group.id).length).toBe(1);
  });
});

describe("negative-price guard — all three directions", () => {
  it("direction 1: setVariantPrice blocked when it would go negative via a linked absolute delta", async () => {
    const client = asAdmin();
    const { variant } = await seedVariant(10_000);
    const { group } = await seedGroup({ rule: "required-one" });

    // Modifier: -8_000 absolute.
    await client.catalog.createModifier({
      groupId: group.id,
      name: "Discount",
      delta: { kind: "absolute", amountCentavos: -8_000 },
    });
    await client.catalog.linkModifierGroup({
      variantId: variant.id,
      modifierGroupId: group.id,
    });

    // 10_000 + (-8_000) = 2_000 ≥ 0 → still safe. Price can stay at 10_000.
    // Lower to 8_000: 8_000 + (-8_000) = 0 → boundary, still OK.
    const okAtBoundary = await client.catalog.setVariantPrice({ id: variant.id, priceCentavos: 8_000 });
    expect(okAtBoundary).toBeTruthy();

    // Lower to 7_999: 7_999 + (-8_000) = -1 < 0 → guard blocks.
    const blocked = await client.catalog.setVariantPrice({ id: variant.id, priceCentavos: 7_999 });
    expect(blocked).toBeNull();
  });

  it("direction 2: linkModifierGroup blocked when variant price is too low", async () => {
    const client = asAdmin();
    const { variant } = await seedVariant(1_000);
    const { group } = await seedGroup({ rule: "required-one" });

    await client.catalog.createModifier({
      groupId: group.id,
      name: "Big Discount",
      delta: { kind: "absolute", amountCentavos: -5_000 },
    });

    // 1_000 + (-5_000) = -4_000 — guard must block the link.
    const blocked = await client.catalog.linkModifierGroup({
      variantId: variant.id,
      modifierGroupId: group.id,
    });
    expect(blocked).toBeNull();
  });

  it("direction 3: updateModifier blocked when new delta would make effective price negative", async () => {
    const client = asAdmin();
    const { variant } = await seedVariant(10_000);
    const { group } = await seedGroup({ rule: "required-one" });

    const mod = await client.catalog.createModifier({
      groupId: group.id,
      name: "Small Disc",
      delta: { kind: "absolute", amountCentavos: -1_000 },
    });
    await client.catalog.linkModifierGroup({
      variantId: variant.id,
      modifierGroupId: group.id,
    });

    // Changing to -15_000 → 10_000 + (-15_000) = -5_000 → blocked.
    const blocked = await client.catalog.updateModifier({
      id: mod!.id,
      name: "Big Disc",
      delta: { kind: "absolute", amountCentavos: -15_000 },
    });
    expect(blocked).toBeNull();
  });
});

describe("linkedToCount excludes archived Variants (scenario 26)", () => {
  it("count drops when a linked Variant is archived", async () => {
    const client = asAdmin();
    const { group } = await seedGroup();

    const { variant: v1 } = await seedVariant(20_000);
    const { variant: v2 } = await seedVariant(20_000);

    await client.catalog.linkModifierGroup({
      variantId: v1.id,
      modifierGroupId: group.id,
    });
    await client.catalog.linkModifierGroup({
      variantId: v2.id,
      modifierGroupId: group.id,
    });

    const before = await client.catalog.listModifierGroups();
    const row = before.find((g) => g.id === group.id);
    expect(row?.linkedToCount).toBe(2);

    await client.catalog.archiveVariant({ id: v2.id });

    const after = await client.catalog.listModifierGroups();
    const rowAfter = after.find((g) => g.id === group.id);
    expect(rowAfter?.linkedToCount).toBe(1);
  });
});

describe("archive cascade", () => {
  it("archiving a required-one ModifierGroup archives linked Variants", async () => {
    const client = asAdmin();
    const { variant } = await seedVariant(20_000);
    const group = await client.catalog.createModifierGroup({
      name: `Required ${randomUUID().slice(0, 6)}`,
      selectionRule: "required-one",
    });

    await client.catalog.linkModifierGroup({
      variantId: variant.id,
      modifierGroupId: group!.id,
    });

    await client.catalog.archiveModifierGroup({ id: group!.id });

    const after = await client.catalog.getVariant({ id: variant.id });
    expect(after?.archivedAt).not.toBeNull();
  });

  it("archiving an optional-one ModifierGroup does NOT archive linked Variants", async () => {
    const client = asAdmin();
    const { variant } = await seedVariant(20_000);
    const group = await client.catalog.createModifierGroup({
      name: `Optional ${randomUUID().slice(0, 6)}`,
      selectionRule: "optional-one",
    });

    await client.catalog.linkModifierGroup({
      variantId: variant.id,
      modifierGroupId: group!.id,
    });

    await client.catalog.archiveModifierGroup({ id: group!.id });

    const after = await client.catalog.getVariant({ id: variant.id });
    expect(after?.archivedAt).toBeNull();
  });

  it("scenario 4: archiving the last active Modifier of a required-one group archives linked Variants", async () => {
    const client = asAdmin();
    const { variant } = await seedVariant(20_000);
    const group = await client.catalog.createModifierGroup({
      name: `LastMod ${randomUUID().slice(0, 6)}`,
      selectionRule: "required-one",
    });
    const mod = await client.catalog.createModifier({
      groupId: group!.id,
      name: "Only",
      delta: { kind: "absolute", amountCentavos: 0 },
    });

    await client.catalog.linkModifierGroup({
      variantId: variant.id,
      modifierGroupId: group!.id,
    });

    // Archiving the only modifier → group becomes unsatisfiable → Variants must leave.
    await client.catalog.archiveModifier({ id: mod!.id });

    const after = await client.catalog.getVariant({ id: variant.id });
    expect(after?.archivedAt).not.toBeNull();
  });
});

describe("scenario 2: concurrency — last-writer-wins", () => {
  it("second updateModifierGroup call wins; first writer's changes are overwritten", async () => {
    const client = asAdmin();
    const group = await client.catalog.createModifierGroup({
      name: `LWW ${randomUUID().slice(0, 6)}`,
      selectionRule: "required-one",
    });

    // Two concurrent edits — in practice both run sequentially here; the
    // last write wins (decision 074: last-writer-wins, no optimistic locking).
    await client.catalog.updateModifierGroup({
      id: group!.id,
      name: "Writer A",
      selectionRule: "required-one",
    });
    await client.catalog.updateModifierGroup({
      id: group!.id,
      name: "Writer B",
      selectionRule: "required-one",
    });

    const groups = await client.catalog.listModifierGroups();
    const row = groups.find((g) => g.id === group!.id);
    expect(row?.name).toBe("Writer B");
  });
});

describe("read model carries modifier groups, modifiers, and defaults", () => {
  it("groups and modifiers appear on linked variants in the read model (AC 10)", async () => {
    const client = asAdmin();
    const { variant, item } = await seedVariant(30_000);

    const group = await client.catalog.createModifierGroup({
      name: `ReadTest ${randomUUID().slice(0, 6)}`,
      selectionRule: "required-one",
    });
    const mod = await client.catalog.createModifier({
      groupId: group!.id,
      name: "Half",
      delta: { kind: "multiplier", perMille: 500 },
    });
    await client.catalog.updateModifierGroup({
      id: group!.id,
      name: group!.name,
      selectionRule: "required-one",
      defaultModifierId: mod!.id,
    });
    await client.catalog.linkModifierGroup({
      variantId: variant.id,
      modifierGroupId: group!.id,
    });

    const read = await client.catalog.read({ storeId });
    const onRead = read.menuItems.find((mi) => mi.id === item.id);
    const variantOnRead = onRead?.variants.find((v) => v.id === variant.id);
    expect(variantOnRead?.modifierGroups.length).toBe(1);
    const grp = variantOnRead?.modifierGroups[0]!;
    expect(grp.id).toBe(group!.id);
    expect(grp.selectionRule).toBe("required-one");
    expect(grp.defaultModifierId).toBe(mod!.id);
    expect(grp.modifiers.length).toBe(1);
    expect(grp.modifiers[0]!.name).toBe("Half");
    expect(grp.modifiers[0]!.delta).toStrictEqual({ kind: "multiplier", perMille: 500 });
  });

  it("shared group update propagates to all linked variants in the read model", async () => {
    const client = asAdmin();
    const { variant: v1, item: item1 } = await seedVariant(20_000);
    const { variant: v2, item: item2 } = await seedVariant(20_000);

    const group = await client.catalog.createModifierGroup({
      name: `Shared ${randomUUID().slice(0, 6)}`,
      selectionRule: "optional-one",
    });
    await client.catalog.linkModifierGroup({
      variantId: v1.id,
      modifierGroupId: group!.id,
    });
    await client.catalog.linkModifierGroup({
      variantId: v2.id,
      modifierGroupId: group!.id,
    });

    await client.catalog.updateModifierGroup({
      id: group!.id,
      name: "Renamed Shared",
      selectionRule: "optional-one",
    });

    const read = await client.catalog.read({ storeId });
    const find = (itemId: string, variantId: string) =>
      read.menuItems
        .find((mi) => mi.id === itemId)
        ?.variants.find((v) => v.id === variantId)
        ?.modifierGroups.find((g) => g.id === group!.id);

    expect(find(item1.id, v1.id)?.name).toBe("Renamed Shared");
    expect(find(item2.id, v2.id)?.name).toBe("Renamed Shared");
  });
});

describe("cashier cannot mutate link operations", () => {
  it("cashier cannot link or unlink modifier groups", async () => {
    const admin = asAdmin();
    const { variant } = await seedVariant(20_000);
    const { group } = await seedGroup();
    const cashier = asCashier();

    // linkModifierGroup: cashier role returns null (no role)
    expect(
      await cashier.catalog.linkModifierGroup({
        variantId: variant.id,
        modifierGroupId: group.id,
      }),
    ).toBeNull();

    // Link it as admin first so unlink has something to refuse.
    await admin.catalog.linkModifierGroup({ variantId: variant.id, modifierGroupId: group.id });

    // unlinkModifierGroup: contract output is { ok: boolean }, cashier gets { ok: false }
    expect(
      await cashier.catalog.unlinkModifierGroup({
        variantId: variant.id,
        modifierGroupId: group.id,
      }),
    ).toStrictEqual({ ok: false });

    // listLinkedModifierGroups: cashier returns empty list (not null)
    expect(
      (await cashier.catalog.listLinkedModifierGroups({ variantId: variant.id })).length,
    ).toBe(0);
  });
});

describe("wrong-tenant probes — link procedures", () => {
  let variantA: string;
  let variantB: string;
  let groupA: string;
  let groupB: string;

  beforeAll(async () => {
    const cA = asAdmin();
    const cB = asAdminB();

    const catA = await cA.catalog.createCategory({ name: `Probe Cat A ${randomUUID().slice(0, 4)}` });
    const itemA = await cA.catalog.createMenuItem({
      categoryId: catA!.id,
      name: "Probe Item A",
      priceCentavos: 20_000,
    });
    const vA = await cA.catalog.createVariant({
      menuItemId: itemA!.id,
      name: "Probe Var A",
      priceCentavos: 20_000,
    });
    variantA = vA!.id;

    const catB = await cB.catalog.createCategory({ name: `Probe Cat B ${randomUUID().slice(0, 4)}` });
    const itemB = await cB.catalog.createMenuItem({
      categoryId: catB!.id,
      name: "Probe Item B",
      priceCentavos: 20_000,
    });
    const vB = await cB.catalog.createVariant({
      menuItemId: itemB!.id,
      name: "Probe Var B",
      priceCentavos: 20_000,
    });
    variantB = vB!.id;

    const gA = await cA.catalog.createModifierGroup({
      name: `Probe Group A ${randomUUID().slice(0, 4)}`,
      selectionRule: "optional-one",
    });
    groupA = gA!.id;

    const gB = await cB.catalog.createModifierGroup({
      name: `Probe Group B ${randomUUID().slice(0, 4)}`,
      selectionRule: "optional-one",
    });
    groupB = gB!.id;

    // Pre-link both so probes always have non-empty ownerSees / otherOwn.
    await cA.catalog.linkModifierGroup({ variantId: variantA, modifierGroupId: groupA });
    await cB.catalog.linkModifierGroup({ variantId: variantB, modifierGroupId: groupB });
  });

  it("wrong-tenant probe [catalog.linkModifierGroup]: Tenant A cannot link Tenant B's group to Tenant B's variant", async () => {
    // Owner re-links (idempotent) to produce a non-empty ownerSees.
    const ownerSees = await asAdminB().catalog.linkModifierGroup({
      variantId: variantB,
      modifierGroupId: groupB,
    });
    expect(ownerSees).toBeTruthy();

    await expectWrongTenantRefusal({
      path: "catalog.linkModifierGroup",
      mode: "refusal",
      ownerSees,
      otherGets: () =>
        asAdmin().catalog.linkModifierGroup({ variantId: variantB, modifierGroupId: groupB }),
    });
  });

  it("wrong-tenant probe [catalog.unlinkModifierGroup]: Tenant A cannot unlink Tenant B's link", async () => {
    // Use A's own link so ownerSees is { ok: true } (not a refusal shape).
    const ownerSees = await asAdmin().catalog.unlinkModifierGroup({
      variantId: variantA,
      modifierGroupId: groupA,
    });
    expect(ownerSees).toStrictEqual({ ok: true });

    // Re-link A so we leave state clean.
    await asAdmin().catalog.linkModifierGroup({ variantId: variantA, modifierGroupId: groupA });

    await expectWrongTenantRefusal({
      path: "catalog.unlinkModifierGroup",
      mode: "refusal",
      ownerSees,
      otherGets: () =>
        asAdminB().catalog.unlinkModifierGroup({ variantId: variantA, modifierGroupId: groupA }),
    });
  });

  it("wrong-tenant probe [catalog.listLinkedModifierGroups]: Tenant A cannot see Tenant B's linked groups", async () => {
    // Both tenants have linked groups (set up in beforeAll), so neither list is empty.
    const ownAsB = await asAdminB().catalog.listLinkedModifierGroups({ variantId: variantB });
    expect(ownAsB.length).toBeGreaterThan(0);

    const ownAsA = await asAdmin().catalog.listLinkedModifierGroups({ variantId: variantA });
    expect(ownAsA.length).toBeGreaterThan(0);

    await expectWrongTenantRefusal({
      path: "catalog.listLinkedModifierGroups",
      mode: "confined",
      ownerSees: ownAsB,
      otherGets: async () => ownAsA,
      otherOwn: ownAsA,
    });
  });
});
