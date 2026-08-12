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
const gcashMethodId = randomUUID();
const unavailableMethodId = randomUUID();
const inactiveMethodId = randomUUID();
const otherTenantMethodId = randomUUID();
const cashierUserId = randomUUID();
const secondStoreCashierId = randomUUID();
let nextDeviceSequence = 1;

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

const makeInput = (orderId = randomUUID()) => {
  const deviceSequence = nextDeviceSequence++;
  return {
    id: orderId,
    paymentMethodId: cashMethodId,
    cashierUserId,
    deviceSequence,
    orderNumber: `${device.code}-${String(deviceSequence).padStart(4, "0")}`,
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
  };
};

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
    .insertInto("User")
    .values([
      {
        id: cashierUserId,
        tenant_id: tenantId,
        email: `order-cashier-${cashierUserId}@test.local`,
        first_name: "Ana",
        last_name: "Reyes",
        password_hash: "test-only",
        must_change_password: false,
        role: "cashier",
      },
      {
        id: secondStoreCashierId,
        tenant_id: tenantId,
        email: `second-order-cashier-${secondStoreCashierId}@test.local`,
        first_name: "Ben",
        last_name: "Santos",
        password_hash: "test-only",
        must_change_password: false,
        role: "cashier",
      },
    ])
    .execute();
  const effectiveFrom = new Date(Date.now() - 60_000);
  await ownerDb
    .insertInto("UserRole")
    .values([
      {
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: cashierUserId,
        role: "cashier",
        effective_from: effectiveFrom,
      },
      {
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: secondStoreCashierId,
        role: "cashier",
        effective_from: effectiveFrom,
      },
    ])
    .execute();
  await ownerDb
    .insertInto("UserStore")
    .values([
      {
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: cashierUserId,
        store_id: storeId,
        assigned: true,
        effective_from: effectiveFrom,
      },
      {
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: secondStoreCashierId,
        store_id: secondStoreId,
        assigned: true,
        effective_from: effectiveFrom,
      },
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
      { id: gcashMethodId, tenant_id: tenantId, name: "GCash", kind: "recorded" },
      { id: unavailableMethodId, tenant_id: tenantId, name: "Card", kind: "recorded" },
      { id: inactiveMethodId, tenant_id: tenantId, name: "Maya", kind: "recorded", active: false },
      { id: otherCashMethodId, tenant_id: otherTenantId, name: "Cash", kind: "cash" },
      { id: otherTenantMethodId, tenant_id: otherTenantId, name: "Other Card", kind: "recorded" },
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
      {
        id: randomUUID(),
        tenant_id: otherTenantId,
        payment_method_id: otherTenantMethodId,
        store_id: otherStoreId,
      },
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
    .deleteFrom("PaymentMethodAvailability")
    .where("tenant_id", "in", [tenantId, otherTenantId])
    .execute();
  await ownerDb
    .deleteFrom("PaymentMethod")
    .where("tenant_id", "in", [tenantId, otherTenantId])
    .execute();
  await ownerDb.deleteFrom("Device").where("tenant_id", "in", [tenantId, otherTenantId]).execute();
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
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
    const result = await client().terminal.submitOrder(input);
    expect(result).toMatchObject({
      ok: true,
      receipt: {
        orderId: input.id,
        orderNumber: input.orderNumber,
        deviceCode: device.code,
        deviceName: device.name,
        cashierUserId,
        cashierName: "Ana Reyes",
        totalCentavos: 25_500,
        amountTenderedCentavos: 30_000,
        changeCentavos: 4_500,
      },
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
      device_sequence: input.deviceSequence,
      order_number: input.orderNumber,
      cashier_user_id: cashierUserId,
      cashier_name: "Ana Reyes",
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
      method_name: "Cash",
      amount_tendered_centavos: 30_000,
      change_centavos: 4_500,
    });
  });

  it("records an exact non-cash tender with its sale-time method name and no change", async () => {
    const input = makeInput();
    input.paymentMethodId = gcashMethodId;
    input.amountTenderedCentavos = input.totalCentavos;

    const result = await client().terminal.submitOrder(input);
    expect(result).toMatchObject({
      ok: true,
      receipt: {
        paymentMethodId: gcashMethodId,
        paymentMethodName: "GCash",
        paymentMethodKind: "recorded",
        amountTenderedCentavos: input.totalCentavos,
        changeCentavos: 0,
      },
    });
    expect(
      await ownerDb
        .selectFrom("Payment")
        .selectAll()
        .where("order_id", "=", input.id)
        .executeTakeFirstOrThrow(),
    ).toMatchObject({ payment_method_id: gcashMethodId, method_name: "GCash", change_centavos: 0 });
  });

  it("refuses recorded change, inactive, unavailable, and another Tenant's methods before creating an Order", async () => {
    const cases = [
      { methodId: gcashMethodId, amount: 25_501 },
      { methodId: inactiveMethodId, amount: 25_500 },
      { methodId: unavailableMethodId, amount: 25_500 },
      { methodId: otherTenantMethodId, amount: 25_500 },
    ];

    for (const entry of cases) {
      const input = makeInput();
      input.paymentMethodId = entry.methodId;
      input.amountTenderedCentavos = entry.amount;
      expect(await client().terminal.submitOrder(input)).toEqual({ ok: false });
      expect(
        await ownerDb
          .selectFrom("Order")
          .select("id")
          .where("id", "=", input.id)
          .executeTakeFirst(),
      ).toBeUndefined();
    }
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

    await expect(
      withTenantScope(appDb, tenantId, (db) =>
        db.updateTable("Order").set({ total_centavos: 1 }).where("id", "=", serial.id).execute(),
      ),
    ).rejects.toThrow();
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

    const mismatchedTotal = makeInput();
    mismatchedTotal.totalCentavos += 1;
    expect(await client().terminal.submitOrder(mismatchedTotal)).toEqual({ ok: false });
  });

  it("refuses a number that does not match the authenticated Device and a reused Device sequence", async () => {
    const mismatched = makeInput();
    mismatched.orderNumber = `B1-${String(mismatched.deviceSequence).padStart(4, "0")}`;
    expect(await client().terminal.submitOrder(mismatched)).toEqual({ ok: false });

    const first = makeInput();
    expect((await client().terminal.submitOrder(first)).ok).toBe(true);
    const collision = makeInput();
    collision.deviceSequence = first.deviceSequence;
    collision.orderNumber = first.orderNumber;
    expect(await client().terminal.submitOrder(collision)).toEqual({ ok: false });
  });

  it("refuses a cashier who is not assigned to the Device Store", async () => {
    const input = makeInput();
    input.cashierUserId = secondStoreCashierId;
    expect(await client().terminal.submitOrder(input)).toEqual({ ok: false });
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

describe("terminal.receipt", () => {
  it("keeps the recorded method name after rename, deactivation, and a refused hard delete", async () => {
    const input = makeInput();
    input.paymentMethodId = gcashMethodId;
    input.amountTenderedCentavos = input.totalCentavos;
    expect((await client().terminal.submitOrder(input)).ok).toBe(true);

    await ownerDb
      .updateTable("PaymentMethod")
      .set({ name: "GCash renamed", active: false })
      .where("id", "=", gcashMethodId)
      .execute();
    await expect(
      ownerDb.deleteFrom("PaymentMethod").where("id", "=", gcashMethodId).execute(),
    ).rejects.toThrow();

    expect(await client().terminal.receipt({ id: input.id })).toMatchObject({
      paymentMethodId: gcashMethodId,
      paymentMethodName: "GCash",
    });
    await ownerDb
      .updateTable("PaymentMethod")
      .set({ name: "GCash", active: true })
      .where("id", "=", gcashMethodId)
      .execute();
  });

  it("reads the persisted receipt projection after catalog names and prices change", async () => {
    const input = makeInput();
    const submitted = await client().terminal.submitOrder(input);
    expect(submitted.ok).toBe(true);

    await ownerDb
      .updateTable("MenuItem")
      .set({ name: "Renamed after sale", price_centavos: 1 })
      .where("id", "=", menuItemId)
      .execute();
    await ownerDb
      .updateTable("Variant")
      .set({ name: "Archived after sale", price_centavos: 1, archived_at: new Date() })
      .where("id", "=", variantId)
      .execute();
    await ownerDb
      .updateTable("User")
      .set({ first_name: "Renamed", last_name: "Cashier" })
      .where("id", "=", cashierUserId)
      .execute();

    const receipt = await client().terminal.receipt({ id: input.id });
    expect(receipt).toMatchObject({
      orderId: input.id,
      orderNumber: input.orderNumber,
      cashierUserId,
      cashierName: "Ana Reyes",
      lines: [
        {
          menuItemName: "Recorded Adobo",
          variantName: "Recorded Whole",
          lineTotalCentavos: 25_500,
          modifiers: [{ name: "Recorded Spicy" }],
          addOns: [{ name: "Recorded Extra rice" }],
        },
      ],
    });

    await ownerDb
      .updateTable("MenuItem")
      .set({ name: "Adobo", price_centavos: 12_000 })
      .where("id", "=", menuItemId)
      .execute();
    await ownerDb
      .updateTable("Variant")
      .set({ name: "Whole", price_centavos: 12_000, archived_at: null })
      .where("id", "=", variantId)
      .execute();
    await ownerDb
      .updateTable("User")
      .set({ first_name: "Ana", last_name: "Reyes" })
      .where("id", "=", cashierUserId)
      .execute();
  });

  it("returns the same opaque result for a wrong Store and a missing Order", async () => {
    const input = makeInput();
    await client().terminal.submitOrder(input);
    expect(
      await seam.actors.asDevice(secondStoreDevice).client.terminal.receipt({ id: input.id }),
    ).toBeNull();
    expect(await client().terminal.receipt({ id: randomUUID() })).toBeNull();
  });

  it("wrong-tenant probe [terminal.receipt]: another Tenant cannot read this Tenant's receipt", async () => {
    const input = makeInput();
    await client().terminal.submitOrder(input);
    await expectWrongTenantRefusal({
      path: "terminal.receipt",
      mode: "refusal",
      ownerSees: await client().terminal.receipt({ id: input.id }),
      otherGets: () => seam.actors.asDevice(otherDevice).client.terminal.receipt({ id: input.id }),
    });
  });
});
