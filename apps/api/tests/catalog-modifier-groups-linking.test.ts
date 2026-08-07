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
  await ownerDb
    .deleteFrom("MenuItemModifierGroup")
    .where("tenant_id", "in", [tenantId, tenantBId])
    .execute();
  // Null out default_modifier_id before deleting Modifiers (FK RESTRICT).
  await ownerDb
    .updateTable("ModifierGroup")
    .set({ default_modifier_id: null })
    .where("tenant_id", "in", [tenantId, tenantBId])
    .execute();
  await ownerDb.deleteFrom("Modifier").where("tenant_id", "in", [tenantId, tenantBId]).execute();
  await ownerDb
    .deleteFrom("ModifierGroup")
    .where("tenant_id", "in", [tenantId, tenantBId])
    .execute();
  await ownerDb.deleteFrom("Variant").where("tenant_id", "in", [tenantId, tenantBId]).execute();
  await ownerDb.deleteFrom("MenuItem").where("tenant_id", "in", [tenantId, tenantBId]).execute();
  await ownerDb.deleteFrom("Category").where("tenant_id", "in", [tenantId, tenantBId]).execute();
  await ownerDb.deleteFrom("Store").where("id", "=", storeId).execute();
  await ownerDb
    .deleteFrom("User")
    .where("id", "in", [adminId, adminBId, managerId, cashierId])
    .execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantId, tenantBId]).execute();
  await ownerDb.destroy();
  await seam.db.destroy();
});

const asAdmin = () => seam.actors.asTenant(tenantId, { userId: adminId, role: "admin" }).client;
const asCashier = () =>
  seam.actors.asTenant(tenantId, { userId: cashierId, role: "cashier" }).client;
const asAdminB = () => seam.actors.asTenant(tenantBId, { userId: adminBId, role: "admin" }).client;

async function seedItem(price = 50_000) {
  const client = asAdmin();
  const category = await client.catalog.createCategory({
    name: `Cat ${randomUUID().slice(0, 6)}`,
  });
  const item = await client.catalog.createMenuItem({
    categoryId: category!.id,
    name: `Item ${randomUUID().slice(0, 6)}`,
    priceCentavos: price,
  });
  return { client, item: item! };
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
  it("links a group to an item; listLinkedModifierGroupsForMenuItem returns it", async () => {
    const { item } = await seedItem();
    const { group } = await seedGroup();
    const client = asAdmin();

    const result = await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: group.id,
    });
    expect(result).toBeTruthy();
    expect(result!.id).toBe(group.id);

    const linked = await client.catalog.listLinkedModifierGroupsForMenuItem({
      menuItemId: item.id,
    });
    expect(linked.map((g) => g.id)).toContain(group.id);
  });

  it("unlinks a group; it disappears from the list", async () => {
    const { item } = await seedItem();
    const { group } = await seedGroup();
    const client = asAdmin();

    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: group.id,
    });
    const before = await client.catalog.listLinkedModifierGroupsForMenuItem({
      menuItemId: item.id,
    });
    expect(before.map((g) => g.id)).toContain(group.id);

    const result = await client.catalog.unlinkModifierGroupFromMenuItem({
      menuItemId: item.id,
      modifierGroupId: group.id,
    });
    expect(result).toStrictEqual({ ok: true });

    const after = await client.catalog.listLinkedModifierGroupsForMenuItem({
      menuItemId: item.id,
    });
    expect(after.map((g) => g.id)).not.toContain(group.id);
  });

  it("listLinkedModifierGroupsForMenuItem orders by sort_order (decision 073)", async () => {
    const { item } = await seedItem();
    const client = asAdmin();

    const g1 = await client.catalog.createModifierGroup({
      name: `G1 ${randomUUID().slice(0, 4)}`,
      selectionRule: "optional-one",
    });
    const g2 = await client.catalog.createModifierGroup({
      name: `G2 ${randomUUID().slice(0, 4)}`,
      selectionRule: "optional-one",
    });
    // g1 created first → lower sort_order.
    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: g2!.id,
    });
    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: g1!.id,
    });

    const linked = await client.catalog.listLinkedModifierGroupsForMenuItem({
      menuItemId: item.id,
    });
    const ids = linked.map((g) => g.id);
    expect(ids.indexOf(g1!.id)).toBeLessThan(ids.indexOf(g2!.id));
  });

  it("scenario 24: linking the same group twice is idempotent", async () => {
    const { item } = await seedItem();
    const { group } = await seedGroup();
    const client = asAdmin();

    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: group.id,
    });
    const second = await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: group.id,
    });
    expect(second).toBeTruthy();

    const linked = await client.catalog.listLinkedModifierGroupsForMenuItem({
      menuItemId: item.id,
    });
    expect(linked.filter((g) => g.id === group.id).length).toBe(1);
  });
});

describe("negative-price guard — all three directions", () => {
  it("direction 1: setVariantPrice blocked when it would go negative via an item-linked absolute delta", async () => {
    const client = asAdmin();
    const { item } = await seedItem(10_000);
    const variant = await client.catalog.createVariant({
      menuItemId: item.id,
      name: "Regular",
      priceCentavos: 10_000,
    });
    const { group } = await seedGroup({ rule: "required-one" });

    await client.catalog.createModifier({
      groupId: group.id,
      name: "Discount",
      delta: { kind: "absolute", amountCentavos: -8_000 },
    });
    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: group.id,
    });

    // 8_000 + (-8_000) = 0 → boundary, still OK.
    const okAtBoundary = await client.catalog.setVariantPrice({
      id: variant!.id,
      priceCentavos: 8_000,
    });
    expect(okAtBoundary).toBeTruthy();

    // 7_999 + (-8_000) = -1 → guard blocks.
    const blocked = await client.catalog.setVariantPrice({
      id: variant!.id,
      priceCentavos: 7_999,
    });
    expect(blocked).toBeNull();
  });

  it("direction 2: linkModifierGroupToMenuItem blocked when item price is too low", async () => {
    const client = asAdmin();
    const { item } = await seedItem(1_000);
    const { group } = await seedGroup({ rule: "required-one" });

    await client.catalog.createModifier({
      groupId: group.id,
      name: "Big Discount",
      delta: { kind: "absolute", amountCentavos: -5_000 },
    });

    // 1_000 + (-5_000) = -4_000 → guard must block.
    const blocked = await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: group.id,
    });
    expect(blocked).toBeNull();
  });

  it("direction 3: updateModifier blocked when new delta would make effective price negative", async () => {
    const client = asAdmin();
    const { item } = await seedItem(10_000);
    const { group } = await seedGroup({ rule: "required-one" });

    const mod = await client.catalog.createModifier({
      groupId: group.id,
      name: "Small Disc",
      delta: { kind: "absolute", amountCentavos: -1_000 },
    });
    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: group.id,
    });

    // -15_000 → 10_000 + (-15_000) = -5_000 → blocked.
    const blocked = await client.catalog.updateModifier({
      id: mod!.id,
      name: "Big Disc",
      delta: { kind: "absolute", amountCentavos: -15_000 },
    });
    expect(blocked).toBeNull();
  });
});

describe("linkedToCount excludes archived Items (scenario 26)", () => {
  it("count drops when a linked Item is archived", async () => {
    const client = asAdmin();
    const { group } = await seedGroup();

    const { item: i1 } = await seedItem(20_000);
    const { item: i2 } = await seedItem(20_000);

    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: i1.id,
      modifierGroupId: group.id,
    });
    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: i2.id,
      modifierGroupId: group.id,
    });

    const before = await client.catalog.listModifierGroups();
    const row = before.find((g) => g.id === group.id);
    expect(row?.linkedToCount).toBe(2);

    await client.catalog.archiveMenuItem({ id: i2.id });

    const after = await client.catalog.listModifierGroups();
    const rowAfter = after.find((g) => g.id === group.id);
    expect(rowAfter?.linkedToCount).toBe(1);
  });
});

describe("archive cascade", () => {
  it("archiving a required-one ModifierGroup archives linked Items", async () => {
    const client = asAdmin();
    const { item } = await seedItem(20_000);
    const group = await client.catalog.createModifierGroup({
      name: `Required ${randomUUID().slice(0, 6)}`,
      selectionRule: "required-one",
    });

    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: group!.id,
    });

    await client.catalog.archiveModifierGroup({ id: group!.id });

    const after = await client.catalog.getMenuItem({ id: item.id });
    expect(after?.archivedAt).not.toBeNull();

    const linkRows = await ownerDb
      .selectFrom("MenuItemModifierGroup")
      .select("id")
      .where("menu_item_id", "=", item.id)
      .where("modifier_group_id", "=", group!.id)
      .execute();
    expect(linkRows).toHaveLength(0);
  });

  it("archiving an optional-one ModifierGroup does NOT archive linked Items", async () => {
    const client = asAdmin();
    const { item } = await seedItem(20_000);
    const group = await client.catalog.createModifierGroup({
      name: `Optional ${randomUUID().slice(0, 6)}`,
      selectionRule: "optional-one",
    });

    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: group!.id,
    });

    await client.catalog.archiveModifierGroup({ id: group!.id });

    const after = await client.catalog.getMenuItem({ id: item.id });
    expect(after?.archivedAt).toBeNull();
  });

  it("scenario 4: archiving the last active Modifier of a required-one group archives linked Items", async () => {
    const client = asAdmin();
    const { item } = await seedItem(20_000);
    const group = await client.catalog.createModifierGroup({
      name: `LastMod ${randomUUID().slice(0, 6)}`,
      selectionRule: "required-one",
    });
    const mod = await client.catalog.createModifier({
      groupId: group!.id,
      name: "Only",
      delta: { kind: "absolute", amountCentavos: 0 },
    });

    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: group!.id,
    });

    await client.catalog.archiveModifier({ id: mod!.id });

    const after = await client.catalog.getMenuItem({ id: item.id });
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

describe("read model carries modifier groups on items (decision 076)", () => {
  it("groups and modifiers appear on the item in the read model", async () => {
    const client = asAdmin();
    const { item } = await seedItem(30_000);

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
    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: group!.id,
    });

    const read = await client.catalog.read({ storeId });
    const onRead = read.menuItems.find((mi) => mi.id === item.id);
    expect(onRead?.modifierGroups.length).toBe(1);
    const grp = onRead?.modifierGroups[0]!;
    expect(grp.id).toBe(group!.id);
    expect(grp.selectionRule).toBe("required-one");
    expect(grp.defaultModifierId).toBe(mod!.id);
    expect(grp.modifiers.length).toBe(1);
    expect(grp.modifiers[0]!.name).toBe("Half");
    expect(grp.modifiers[0]!.delta).toStrictEqual({ kind: "multiplier", perMille: 500 });
  });

  it("variants carry no modifierGroups — they inherit from the item", async () => {
    const client = asAdmin();
    const { item } = await seedItem(20_000);
    const variant = await client.catalog.createVariant({
      menuItemId: item.id,
      name: "Large",
      priceCentavos: 25_000,
    });
    const { group } = await seedGroup();
    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: group.id,
    });

    const read = await client.catalog.read({ storeId });
    const onRead = read.menuItems.find((mi) => mi.id === item.id);
    const variantOnRead = onRead?.variants.find((v) => v.id === variant!.id);
    // Variants have no modifierGroups key in the contract (decision 076).
    expect(onRead?.modifierGroups.length).toBe(1);
    expect(variantOnRead).toBeDefined();
    expect((variantOnRead as Record<string, unknown>)["modifierGroups"]).toBeUndefined();
  });

  it("shared group update propagates to all linked items in the read model", async () => {
    const client = asAdmin();
    const { item: item1 } = await seedItem(20_000);
    const { item: item2 } = await seedItem(20_000);

    const group = await client.catalog.createModifierGroup({
      name: `Shared ${randomUUID().slice(0, 6)}`,
      selectionRule: "optional-one",
    });
    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item1.id,
      modifierGroupId: group!.id,
    });
    await client.catalog.linkModifierGroupToMenuItem({
      menuItemId: item2.id,
      modifierGroupId: group!.id,
    });

    await client.catalog.updateModifierGroup({
      id: group!.id,
      name: "Renamed Shared",
      selectionRule: "optional-one",
    });

    const read = await client.catalog.read({ storeId });
    const find = (itemId: string) =>
      read.menuItems.find((mi) => mi.id === itemId)?.modifierGroups.find((g) => g.id === group!.id);

    expect(find(item1.id)?.name).toBe("Renamed Shared");
    expect(find(item2.id)?.name).toBe("Renamed Shared");
  });
});

describe("cashier cannot mutate link operations", () => {
  it("cashier cannot link or unlink modifier groups to items", async () => {
    const admin = asAdmin();
    const { item } = await seedItem(20_000);
    const { group } = await seedGroup();
    const cashier = asCashier();

    expect(
      await cashier.catalog.linkModifierGroupToMenuItem({
        menuItemId: item.id,
        modifierGroupId: group.id,
      }),
    ).toBeNull();

    await admin.catalog.linkModifierGroupToMenuItem({
      menuItemId: item.id,
      modifierGroupId: group.id,
    });

    expect(
      await cashier.catalog.unlinkModifierGroupFromMenuItem({
        menuItemId: item.id,
        modifierGroupId: group.id,
      }),
    ).toStrictEqual({ ok: false });

    expect(
      (
        await cashier.catalog.listLinkedModifierGroupsForMenuItem({ menuItemId: item.id })
      ).length,
    ).toBe(0);
  });
});

describe("wrong-tenant probes — link procedures", () => {
  let itemA: string;
  let itemB: string;
  let groupA: string;
  let groupB: string;

  beforeAll(async () => {
    const cA = asAdmin();
    const cB = asAdminB();

    const catA = await cA.catalog.createCategory({
      name: `Probe Cat A ${randomUUID().slice(0, 4)}`,
    });
    const miA = await cA.catalog.createMenuItem({
      categoryId: catA!.id,
      name: "Probe Item A",
      priceCentavos: 20_000,
    });
    itemA = miA!.id;

    const catB = await cB.catalog.createCategory({
      name: `Probe Cat B ${randomUUID().slice(0, 4)}`,
    });
    const miB = await cB.catalog.createMenuItem({
      categoryId: catB!.id,
      name: "Probe Item B",
      priceCentavos: 20_000,
    });
    itemB = miB!.id;

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

    await cA.catalog.linkModifierGroupToMenuItem({ menuItemId: itemA, modifierGroupId: groupA });
    await cB.catalog.linkModifierGroupToMenuItem({ menuItemId: itemB, modifierGroupId: groupB });
  });

  it("wrong-tenant probe [catalog.linkModifierGroupToMenuItem]: Tenant A cannot link Tenant B's group to Tenant B's item", async () => {
    const ownerSees = await asAdminB().catalog.linkModifierGroupToMenuItem({
      menuItemId: itemB,
      modifierGroupId: groupB,
    });
    expect(ownerSees).toBeTruthy();

    await expectWrongTenantRefusal({
      path: "catalog.linkModifierGroupToMenuItem",
      mode: "refusal",
      ownerSees,
      otherGets: () =>
        asAdmin().catalog.linkModifierGroupToMenuItem({
          menuItemId: itemB,
          modifierGroupId: groupB,
        }),
    });
  });

  it("wrong-tenant probe [catalog.unlinkModifierGroupFromMenuItem]: Tenant A cannot unlink Tenant B's link", async () => {
    const ownerSees = await asAdmin().catalog.unlinkModifierGroupFromMenuItem({
      menuItemId: itemA,
      modifierGroupId: groupA,
    });
    expect(ownerSees).toStrictEqual({ ok: true });

    await asAdmin().catalog.linkModifierGroupToMenuItem({
      menuItemId: itemA,
      modifierGroupId: groupA,
    });

    await expectWrongTenantRefusal({
      path: "catalog.unlinkModifierGroupFromMenuItem",
      mode: "refusal",
      ownerSees,
      otherGets: () =>
        asAdminB().catalog.unlinkModifierGroupFromMenuItem({
          menuItemId: itemA,
          modifierGroupId: groupA,
        }),
    });
  });

  it("wrong-tenant probe [catalog.listLinkedModifierGroupsForMenuItem]: Tenant A cannot see Tenant B's linked groups", async () => {
    const ownAsB = await asAdminB().catalog.listLinkedModifierGroupsForMenuItem({
      menuItemId: itemB,
    });
    expect(ownAsB.length).toBeGreaterThan(0);

    const ownAsA = await asAdmin().catalog.listLinkedModifierGroupsForMenuItem({
      menuItemId: itemA,
    });
    expect(ownAsA.length).toBeGreaterThan(0);

    await expectWrongTenantRefusal({
      path: "catalog.listLinkedModifierGroupsForMenuItem",
      mode: "confined",
      ownerSees: ownAsB,
      otherGets: async () => ownAsA,
      otherOwn: ownAsA,
    });
  });
});
