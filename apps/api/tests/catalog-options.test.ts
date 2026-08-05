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

beforeAll(async () => {
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Options Tenant" }).execute();
  await ownerDb
    .insertInto("User")
    .values([
      {
        id: adminId,
        tenant_id: tenantId,
        email: `options-admin-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "admin",
      },
      {
        id: managerId,
        tenant_id: tenantId,
        email: `options-mgr-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "manager",
      },
      {
        id: cashierId,
        tenant_id: tenantId,
        email: `options-cash-${randomUUID()}@test.local`,
        password_hash: passwordHash,
        role: "cashier",
      },
    ])
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Modifier").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("ModifierGroup").where("tenant_id", "=", tenantId).execute();
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

describe("catalog options library", () => {
  it("manager creates a group with modifiers; linkedToCount comes from the query as 0", async () => {
    const client = asManager();
    const group = await client.catalog.createModifierGroup({
      name: `Size ${randomUUID().slice(0, 6)}`,
      selectionRule: "required-one",
    });
    expect(group).toBeTruthy();
    expect(group!.linkedToCount).toBe(0);
    expect(group!.defaultModifierId).toBeNull();

    const whole = await client.catalog.createModifier({
      groupId: group!.id,
      name: "Whole",
      delta: { kind: "multiplier", perMille: 1000 },
    });
    const half = await client.catalog.createModifier({
      groupId: group!.id,
      name: "Half",
      delta: { kind: "multiplier", perMille: 500 },
    });
    expect(whole?.delta).toEqual({ kind: "multiplier", perMille: 1000 });
    expect(half?.delta).toEqual({ kind: "multiplier", perMille: 500 });

    const listed = await client.catalog.listModifierGroups();
    const row = listed.find((g) => g.id === group!.id);
    expect(row?.linkedToCount).toBe(0);
    expect(row?.modifiers.map((m) => m.name).sort()).toEqual(["Half", "Whole"]);
  });

  it("accepts absolute and multiplier bounds at the edges; refuses outside", async () => {
    const client = asAdmin();
    const group = await client.catalog.createModifierGroup({
      name: `Bounds ${randomUUID().slice(0, 6)}`,
      selectionRule: "optional-one",
    });

    const okAbs = await client.catalog.createModifier({
      groupId: group!.id,
      name: "Edge abs",
      delta: { kind: "absolute", amountCentavos: 100_000 },
    });
    expect(okAbs).toBeTruthy();

    await expect(
      client.catalog.createModifier({
        groupId: group!.id,
        name: "Bad abs",
        delta: { kind: "absolute", amountCentavos: 100_001 },
      }),
    ).rejects.toThrow();

    const okMult = await client.catalog.createModifier({
      groupId: group!.id,
      name: "Edge mult",
      delta: { kind: "multiplier", perMille: 10_000 },
    });
    expect(okMult).toBeTruthy();
  });

  it("refuses many with maximum 0 at the database CHECK", async () => {
    await expect(
      ownerDb
        .insertInto("ModifierGroup")
        .values({
          id: randomUUID(),
          tenant_id: tenantId,
          name: `Bad many ${randomUUID().slice(0, 6)}`,
          selection_rule: "many",
          maximum: 0,
          sort_order: 9999,
        })
        .execute(),
    ).rejects.toThrow();
  });

  it("archives groups and modifiers rather than deleting", async () => {
    const client = asAdmin();
    const group = await client.catalog.createModifierGroup({
      name: `Archive ${randomUUID().slice(0, 6)}`,
      selectionRule: "many",
      maximum: 2,
    });
    const mod = await client.catalog.createModifier({
      groupId: group!.id,
      name: "Extra",
      delta: { kind: "absolute", amountCentavos: 1500 },
    });
    const archivedMod = await client.catalog.archiveModifier({ id: mod!.id });
    expect(archivedMod?.archivedAt).not.toBeNull();
    const archivedGroup = await client.catalog.archiveModifierGroup({ id: group!.id });
    expect(archivedGroup?.archivedAt).not.toBeNull();

    const still = await ownerDb
      .selectFrom("Modifier")
      .select("id")
      .where("id", "=", mod!.id)
      .executeTakeFirst();
    expect(still?.id).toBe(mod!.id);
  });

  it("reorders modifiers within a group", async () => {
    const client = asAdmin();
    const group = await client.catalog.createModifierGroup({
      name: `Reorder ${randomUUID().slice(0, 6)}`,
      selectionRule: "optional-one",
    });
    const a = await client.catalog.createModifier({
      groupId: group!.id,
      name: "A",
      delta: { kind: "absolute", amountCentavos: 100 },
    });
    const b = await client.catalog.createModifier({
      groupId: group!.id,
      name: "B",
      delta: { kind: "absolute", amountCentavos: 200 },
    });
    await client.catalog.reorderModifier({ id: b!.id, direction: "up" });
    const listed = await client.catalog.listModifiers({ groupId: group!.id });
    const active = listed.filter((m) => !m.archivedAt).sort((x, y) => x.sortOrder - y.sortOrder);
    expect(active.map((m) => m.id)).toEqual([b!.id, a!.id]);
  });

  it("allows a group with no default modifier", async () => {
    const client = asAdmin();
    const group = await client.catalog.createModifierGroup({
      name: `NoDefault ${randomUUID().slice(0, 6)}`,
      selectionRule: "required-one",
    });
    expect(group?.defaultModifierId).toBeNull();
  });

  it("cashier cannot mutate options", async () => {
    const admin = asAdmin();
    const group = await admin.catalog.createModifierGroup({
      name: `Cashier ${randomUUID().slice(0, 6)}`,
      selectionRule: "optional-one",
    });
    const cashier = asCashier();
    expect(
      await cashier.catalog.createModifierGroup({
        name: "Nope",
        selectionRule: "optional-one",
      }),
    ).toBeNull();
    expect(
      await cashier.catalog.createModifier({
        groupId: group!.id,
        name: "Nope",
        delta: { kind: "absolute", amountCentavos: 1 },
      }),
    ).toBeNull();
    expect(await cashier.catalog.listModifierGroups()).toEqual([]);
  });

  it("stores no floats on modifier delta columns", async () => {
    const client = asAdmin();
    const group = await client.catalog.createModifierGroup({
      name: `Int ${randomUUID().slice(0, 6)}`,
      selectionRule: "optional-one",
    });
    const mod = await client.catalog.createModifier({
      groupId: group!.id,
      name: "Half",
      delta: { kind: "multiplier", perMille: 500 },
    });
    const row = await ownerDb
      .selectFrom("Modifier")
      .select(["delta_kind", "delta_value"])
      .where("id", "=", mod!.id)
      .executeTakeFirstOrThrow();
    expect(row.delta_kind).toBe("multiplier");
    expect(Number.isInteger(row.delta_value)).toBe(true);
    expect(row.delta_value).toBe(500);
  });
});
