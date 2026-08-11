import { randomUUID } from "node:crypto";

import { createDb, withTenantScope } from "backend/src/db/client.ts";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const appDb = createDb({ databaseUrl: process.env.APP_DATABASE_URI! });

const tenantId = randomUUID();
const otherTenantId = randomUUID();
const storeId = randomUUID();
const otherStoreId = randomUUID();
const secondStoreId = randomUUID();
const deviceId = randomUUID();
const otherDeviceId = randomUUID();
const secondDeviceId = randomUUID();
const categoryId = randomUUID();
const menuItemId = randomUUID();
const variantId = randomUUID();
const modifierGroupId = randomUUID();
const modifierId = randomUUID();
const addOnId = randomUUID();
const cashMethodId = randomUUID();
const otherCashMethodId = randomUUID();

const device = {
  tenantId,
  storeId,
  deviceId,
  code: "A1",
  name: "Order Terminal",
  assignedUserId: null,
};

const otherDevice = {
  tenantId: otherTenantId,
  storeId: otherStoreId,
  deviceId: otherDeviceId,
  code: "B1",
  name: "Other Terminal",
  assignedUserId: null,
};

const secondStoreDevice = {
  tenantId,
  storeId: secondStoreId,
  deviceId: secondDeviceId,
  code: "A2",
  name: "Second Store Terminal",
  assignedUserId: null,
};

const makeInput = (orderId = randomUUID()) => ({
  id: orderId,
  lines: [
    {
      menuItemId,
      menuItemName: "Recorded Adobo",
      variantId,
      variantName: "Recorded Whole",
      unitPriceCentavos: 12_000,
      quantity: 2,
      lineTotalCentavos: 25_500,
      modifiers: [
        {
          id: modifierId,
          name: "Recorded Spicy",
          deltaKind: "absolute" as const,
          deltaValue: 0,
        },
      ],
      addOns: [
        {
          id: addOnId,
          name: "Recorded Extra rice",
          deltaKind: "absolute" as const,
          deltaValue: 750,
        },
      ],
    },
  ],
  totalCentavos: 25_500,
  amountTenderedCentavos: 30_000,
});

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantId, name: "Order Tenant" },
      { id: otherTenantId, name: "Other Order Tenant" },
    ])
    .execute();
  await ownerDb
    .insertInto("Store")
    .values([
      { id: storeId, tenant_id: tenantId, name: "Order Store" },
      { id: secondStoreId, tenant_id: tenantId, name: "Second Order Store" },
      { id: otherStoreId, tenant_id: otherTenantId, name: "Other Order Store" },
    ])
    .execute();
  await ownerDb
    .insertInto("Device")
    .values([
      {
        id: deviceId,
        tenant_id: tenantId,
        store_id: storeId,
        name: device.name,
        code: device.code,
        token_hash: `order-${deviceId}`,
      },
      {
        id: secondDeviceId,
        tenant_id: tenantId,
        store_id: secondStoreId,
        name: secondStoreDevice.name,
        code: secondStoreDevice.code,
        token_hash: `order-${secondDeviceId}`,
      },
      {
        id: otherDeviceId,
        tenant_id: otherTenantId,
        store_id: otherStoreId,
        name: otherDevice.name,
        code: otherDevice.code,
        token_hash: `order-${otherDeviceId}`,
      },
    ])
    .execute();
  await ownerDb
    .insertInto("PaymentMethod")
    .values([
      { id: cashMethodId, tenant_id: tenantId, name: "Cash", kind: "cash" },
      { id: otherCashMethodId, tenant_id: otherTenantId, name: "Cash", kind: "cash" },
    ])
    .execute();
  await ownerDb
    .insertInto("Category")
    .values({ id: categoryId, tenant_id: tenantId, name: "Food", sort_order: 0 })
    .execute();
  await ownerDb
    .insertInto("MenuItem")
    .values({
      id: menuItemId,
      tenant_id: tenantId,
      category_id: categoryId,
      name: "Adobo",
      price_centavos: 12_000,
      sort_order: 0,
    })
    .execute();
  await ownerDb
    .insertInto("Variant")
    .values({
      id: variantId,
      tenant_id: tenantId,
      menu_item_id: menuItemId,
      name: "Whole",
      price_centavos: 12_000,
      sort_order: 0,
    })
    .execute();
  await ownerDb
    .insertInto("ModifierGroup")
    .values({
      id: modifierGroupId,
      tenant_id: tenantId,
      name: "Heat",
      selection_rule: "required-one",
      maximum: null,
      default_modifier_id: null,
      sort_order: 0,
    })
    .execute();
  await ownerDb
    .insertInto("Modifier")
    .values({
      id: modifierId,
      tenant_id: tenantId,
      group_id: modifierGroupId,
      name: "Spicy",
      delta_kind: "absolute",
      delta_value: 0,
      sort_order: 0,
    })
    .execute();
  await ownerDb
    .insertInto("MenuItemModifierGroup")
    .values({
      id: randomUUID(),
      tenant_id: tenantId,
      menu_item_id: menuItemId,
      modifier_group_id: modifierGroupId,
    })
    .execute();
  await ownerDb
    .insertInto("AddOn")
    .values({
      id: addOnId,
      tenant_id: tenantId,
      name: "Extra rice",
      delta_kind: "absolute",
      delta_value: 750,
      maximum: 1,
      sort_order: 0,
    })
    .execute();
  await ownerDb
    .insertInto("MenuItemAddOn")
    .values({
      id: randomUUID(),
      tenant_id: tenantId,
      menu_item_id: menuItemId,
      add_on_id: addOnId,
    })
    .execute();
  await ownerDb
    .insertInto("VariantUnavailability")
    .values({
      id: randomUUID(),
      tenant_id: tenantId,
      variant_id: variantId,
      store_id: secondStoreId,
    })
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Payment").where("tenant_id", "in", [tenantId, otherTenantId]).execute();
  await ownerDb
    .deleteFrom("OrderLine")
    .where("tenant_id", "in", [tenantId, otherTenantId])
    .execute();
  await ownerDb.deleteFrom("Order").where("tenant_id", "in", [tenantId, otherTenantId]).execute();
  await ownerDb.deleteFrom("VariantUnavailability").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("MenuItemAddOn").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("AddOn").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("MenuItemModifierGroup").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Modifier").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("ModifierGroup").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Variant").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("MenuItem").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Category").where("tenant_id", "=", tenantId).execute();
  await ownerDb
    .deleteFrom("PaymentMethod")
    .where("tenant_id", "in", [tenantId, otherTenantId])
    .execute();
  await ownerDb.deleteFrom("Device").where("tenant_id", "in", [tenantId, otherTenantId]).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "in", [tenantId, otherTenantId]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [tenantId, otherTenantId]).execute();
  await ownerDb.destroy();
  await appDb.destroy();
  await seam.db.destroy();
});

const client = () => seam.actors.asDevice(device).client;

describe("terminal.submitOrder", () => {
  it("stores one paid Order, its sale-time line snapshot, and its cash Payment", async () => {
    const input = makeInput();
    expect(await client().terminal.submitOrder(input)).toEqual({
      ok: true,
      orderId: input.id,
      changeCentavos: 4_500,
    });

    const order = await ownerDb
      .selectFrom("Order")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirstOrThrow();
    const line = await ownerDb
      .selectFrom("OrderLine")
      .selectAll()
      .where("order_id", "=", input.id)
      .executeTakeFirstOrThrow();
    const payment = await ownerDb
      .selectFrom("Payment")
      .selectAll()
      .where("order_id", "=", input.id)
      .executeTakeFirstOrThrow();

    expect(order).toMatchObject({
      tenant_id: tenantId,
      store_id: storeId,
      device_id: deviceId,
      drawer_session_id: null,
      status: "paid",
      total_centavos: 25_500,
    });
    expect(line).toMatchObject({
      menu_item_id: menuItemId,
      menu_item_name: "Recorded Adobo",
      variant_id: variantId,
      variant_name: "Recorded Whole",
      unit_price_centavos: 12_000,
      quantity: 2,
      line_total_centavos: 25_500,
    });
    expect(line.modifier_snapshot).toEqual(input.lines[0]!.modifiers);
    expect(line.addon_snapshot).toEqual(input.lines[0]!.addOns);
    expect(payment).toMatchObject({
      payment_method_id: cashMethodId,
      method: "cash",
      amount_tendered_centavos: 30_000,
      change_centavos: 4_500,
    });
  });

  it("makes serial and parallel retries immutable and idempotent", async () => {
    const serial = makeInput();
    const first = await client().terminal.submitOrder(serial);
    const changed = {
      ...serial,
      amountTenderedCentavos: 40_000,
      lines: [{ ...serial.lines[0]!, menuItemName: "Changed retry name" }],
    };
    expect(await client().terminal.submitOrder(changed)).toEqual(first);

    const parallel = makeInput();
    const results = await Promise.all([
      client().terminal.submitOrder(parallel),
      client().terminal.submitOrder(parallel),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(
      await ownerDb.selectFrom("Order").select("id").where("id", "=", parallel.id).execute(),
    ).toHaveLength(1);
    expect(
      await ownerDb
        .selectFrom("OrderLine")
        .select("id")
        .where("order_id", "=", parallel.id)
        .execute(),
    ).toHaveLength(1);
    expect(
      await ownerDb
        .selectFrom("Payment")
        .select("id")
        .where("order_id", "=", parallel.id)
        .execute(),
    ).toHaveLength(1);

    const storedSerial = await ownerDb
      .selectFrom("OrderLine")
      .select("menu_item_name")
      .where("order_id", "=", serial.id)
      .executeTakeFirstOrThrow();
    expect(storedSerial.menu_item_name).toBe("Recorded Adobo");
  });

  it("refuses underpayment, missing required Modifiers, excess Add-ons, and another Store's unavailable Variant", async () => {
    const underpaid = makeInput();
    underpaid.amountTenderedCentavos = underpaid.totalCentavos - 1;
    expect(await client().terminal.submitOrder(underpaid)).toEqual({ ok: false });

    const missingModifier = makeInput();
    missingModifier.lines[0]!.modifiers = [];
    expect(await client().terminal.submitOrder(missingModifier)).toEqual({ ok: false });

    const excessAddOn = makeInput();
    excessAddOn.lines[0]!.addOns.push(excessAddOn.lines[0]!.addOns[0]!);
    expect(await client().terminal.submitOrder(excessAddOn)).toEqual({ ok: false });

    expect(
      await seam.actors.asDevice(secondStoreDevice).client.terminal.submitOrder(makeInput()),
    ).toEqual({ ok: false });
  });

  it("refuses an archived Variant", async () => {
    await ownerDb
      .updateTable("Variant")
      .set({ archived_at: new Date() })
      .where("id", "=", variantId)
      .execute();
    expect(await client().terminal.submitOrder(makeInput())).toEqual({ ok: false });
    await ownerDb
      .updateTable("Variant")
      .set({ archived_at: null })
      .where("id", "=", variantId)
      .execute();
  });

  it("keeps the original snapshot after catalog names and prices change", async () => {
    const input = makeInput();
    expect((await client().terminal.submitOrder(input)).ok).toBe(true);
    await ownerDb
      .updateTable("MenuItem")
      .set({ name: "New Adobo", price_centavos: 99_999 })
      .where("id", "=", menuItemId)
      .execute();
    await ownerDb
      .updateTable("Variant")
      .set({ name: "New Whole", price_centavos: 99_999 })
      .where("id", "=", variantId)
      .execute();

    const line = await ownerDb
      .selectFrom("OrderLine")
      .selectAll()
      .where("order_id", "=", input.id)
      .executeTakeFirstOrThrow();
    expect(line).toMatchObject({
      menu_item_name: "Recorded Adobo",
      variant_name: "Recorded Whole",
      unit_price_centavos: 12_000,
      line_total_centavos: 25_500,
    });
  });

  it("logs identity and outcome without payloads or amounts", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const input = makeInput();
    await client().terminal.submitOrder(input);
    const logged = JSON.stringify(info.mock.calls);
    expect(logged).toContain(input.id);
    expect(logged).toContain(storeId);
    expect(logged).toContain(deviceId);
    expect(logged).toContain("created");
    expect(logged).not.toContain("Recorded Adobo");
    expect(logged).not.toContain("30000");
    info.mockRestore();
  });

  it("an Order lookup is equally empty for another Tenant and a nonexistent id", async () => {
    const input = makeInput();
    await client().terminal.submitOrder(input);
    const read = (id: string) =>
      withTenantScope(appDb, otherTenantId, (db) =>
        db.selectFrom("Order").select("id").where("id", "=", id).executeTakeFirst(),
      );
    expect(await read(input.id)).toBeUndefined();
    expect(await read(randomUUID())).toBeUndefined();
  });

  it("wrong-tenant probe [terminal.submitOrder]: another Tenant cannot submit this Tenant's catalog", async () => {
    const input = makeInput();
    await expectWrongTenantRefusal({
      path: "terminal.submitOrder",
      mode: "refusal",
      ownerSees: await client().terminal.submitOrder(input),
      otherGets: () => seam.actors.asDevice(otherDevice).client.terminal.submitOrder(makeInput()),
      why: "An Order may only use catalog records belonging to its Device Tenant.",
    });
  });
});
