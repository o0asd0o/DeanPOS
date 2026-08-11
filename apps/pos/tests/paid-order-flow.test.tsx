import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  createDb,
  expectNoAxeViolations,
  fireEvent,
  hashPassword,
  renderRoute,
  screen,
  waitFor,
  withTenantScope,
} from "api/src/test-seam-react.tsx";
import { hashPin } from "contract/src/pin.ts";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { clearDeviceToken, writeDeviceToken } from "@/lib/device-token.ts";
import { clearPinRoster } from "@/lib/pin-roster.ts";
import { router } from "@/router.tsx";

const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const tenantId = randomUUID();
const storeId = randomUUID();
const userId = randomUUID();
const deviceId = randomUUID();
const cashMethodId = randomUUID();
const categoryId = randomUUID();
const menuItemId = randomUUID();
const pin = "135790";
const token = randomBytes(32).toString("base64url");

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event("resize"));
}

async function unlock() {
  await waitFor(() => expect(screen.getByText("Ana Reyes")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Ana Reyes" }));
  for (const digit of pin) fireEvent.click(screen.getByRole("button", { name: digit }));
  fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
  await waitFor(() => expect(screen.getByText("Lock")).toBeTruthy());
}

beforeAll(async () => {
  await ownerDb.insertInto("Tenant").values({ id: tenantId, name: "Checkout Tenant" }).execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: userId,
      tenant_id: tenantId,
      email: `checkout-${randomUUID()}@test.local`,
      password_hash: await hashPassword("irrelevant"),
      first_name: "Ana",
      last_name: "Reyes",
      role: "cashier",
      pin_hash: await hashPin(pin),
    })
    .execute();
  await ownerDb
    .insertInto("UserRole")
    .values({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: userId,
      role: "cashier",
      effective_from: new Date(Date.now() - 60_000),
    })
    .execute();
  await withTenantScope(ownerDb, tenantId, (db) =>
    db
      .insertInto("Store")
      .values({ id: storeId, tenant_id: tenantId, name: "Checkout Store" })
      .execute(),
  );
  await ownerDb
    .insertInto("UserStore")
    .values({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: userId,
      store_id: storeId,
      assigned: true,
      effective_from: new Date(Date.now() - 60_000),
    })
    .execute();
  await ownerDb
    .insertInto("Device")
    .values({
      id: deviceId,
      tenant_id: tenantId,
      store_id: storeId,
      name: "Checkout Terminal",
      code: "C2",
      token_hash: createHash("sha256").update(Buffer.from(token, "utf8")).digest("hex"),
    })
    .execute();
  await ownerDb
    .insertInto("PaymentMethod")
    .values({ id: cashMethodId, tenant_id: tenantId, name: "Cash", kind: "cash" })
    .execute();
  await ownerDb
    .insertInto("Category")
    .values({ id: categoryId, tenant_id: tenantId, name: "Meals", sort_order: 0 })
    .execute();
  await ownerDb
    .insertInto("MenuItem")
    .values({
      id: menuItemId,
      tenant_id: tenantId,
      category_id: categoryId,
      name: "Rice meal",
      price_centavos: 15_000,
      sort_order: 0,
    })
    .execute();
});

afterEach(() => {
  clearDeviceToken();
  clearPinRoster();
  localStorage.clear();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Payment").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("OrderLine").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Order").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("MenuItem").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Category").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("PaymentMethod").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Device").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserStore").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("UserRole").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("paid cash order flow", () => {
  it("rings up, pays, confirms on screen, clears the Draft, and persists every row", async () => {
    writeDeviceToken(token, {
      deviceId,
      name: "Checkout Terminal",
      code: "C2",
      storeId,
      storeName: "Checkout Store",
    });
    setViewport(1280, 800);
    const { container, db } = renderRoute({ router });

    await unlock();
    await waitFor(() => expect(screen.getByRole("button", { name: /Rice meal/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Rice meal/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pay ₱150.00" }));
    expect(screen.getByRole("region", { name: "Payment" })).toBeTruthy();
    await expectNoAxeViolations(container);

    setViewport(390, 844);
    await expectNoAxeViolations(container);
    fireEvent.click(screen.getByRole("button", { name: "Tender ₱200" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete sale" }));

    await waitFor(() => expect(screen.getByText("Sale completed")).toBeTruthy());
    expect(localStorage.getItem("deanpos.sale.draft")).toBeNull();
    expect(screen.getByRole("region", { name: "Receipt" })).toBeTruthy();
    expect(screen.getByText("Order C2-0001")).toBeTruthy();
    expect(screen.getByText("Cashier · Ana Reyes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New order" }));
    expect(screen.getByText("0 items · ₱0.00 · Open cart")).toBeTruthy();

    const order = await ownerDb
      .selectFrom("Order")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .executeTakeFirstOrThrow();
    expect(order).toMatchObject({
      store_id: storeId,
      device_id: deviceId,
      device_sequence: 1,
      order_number: "C2-0001",
      cashier_user_id: userId,
      cashier_name: "Ana Reyes",
      status: "paid",
      total_centavos: 15_000,
    });
    expect(
      await ownerDb
        .selectFrom("OrderLine")
        .select("order_id")
        .where("order_id", "=", order.id)
        .execute(),
    ).toHaveLength(1);
    expect(
      await ownerDb
        .selectFrom("Payment")
        .select("order_id")
        .where("order_id", "=", order.id)
        .execute(),
    ).toHaveLength(1);
    await db.destroy();
  });
});
