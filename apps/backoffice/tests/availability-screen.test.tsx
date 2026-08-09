import { randomUUID } from "node:crypto";

import {
  createDb,
  expectNoAxeViolations,
  fireEvent,
  hashPassword,
  renderRoute,
  screen,
  waitFor,
  within,
} from "api/src/test-seam-react.tsx";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const tenantId = randomUUID();
const adminId = randomUUID();
const storeId = randomUUID();
const categoryId = randomUUID();
const itemId = randomUUID();
const variantId = randomUUID();

beforeAll(async () => {
  const passwordHash = await hashPassword("irrelevant");
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Availability Screen" })
    .execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: adminId,
      tenant_id: tenantId,
      email: `availability-screen-${randomUUID()}@test.local`,
      password_hash: passwordHash,
      role: "admin",
    })
    .execute();
  await ownerDb
    .insertInto("Store")
    .values({ id: storeId, tenant_id: tenantId, name: "Screen Store" })
    .execute();
  await ownerDb
    .insertInto("Category")
    .values({ id: categoryId, tenant_id: tenantId, name: "Meals", sort_order: 0 })
    .execute();
  await ownerDb
    .insertInto("MenuItem")
    .values({
      id: itemId,
      tenant_id: tenantId,
      category_id: categoryId,
      name: "Adobo",
      price_centavos: 10000,
      sort_order: 0,
    })
    .execute();
  await ownerDb
    .insertInto("Variant")
    .values({
      id: variantId,
      tenant_id: tenantId,
      menu_item_id: itemId,
      name: "Regular",
      price_centavos: 10000,
      sort_order: 0,
    })
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("VariantUnavailability").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("MenuItemUnavailability").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Variant").where("id", "=", variantId).execute();
  await ownerDb.deleteFrom("MenuItem").where("id", "=", itemId).execute();
  await ownerDb.deleteFrom("Category").where("id", "=", categoryId).execute();
  await ownerDb.deleteFrom("Store").where("id", "=", storeId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", adminId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("Availability screen", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("uses a single-select Store combobox and stages a switch without writing until Save", async () => {
    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: `/availability?store=${storeId}`,
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Availability" })).toBeTruthy());
    const combobox = screen.getByRole("combobox", { name: "Store" });
    expect(combobox).toBeTruthy();
    await waitFor(() => expect((combobox as HTMLInputElement).value).toBe("Screen Store"));
    fireEvent.focus(combobox);
    await waitFor(() => expect(screen.getByRole("option", { name: "Screen Store" })).toBeTruthy());
    fireEvent.click(screen.getByRole("option", { name: "Screen Store" }));

    const toggle = await screen.findByRole("switch", { name: "Regular at Screen Store" });
    expect(toggle.getAttribute("data-state")).toBe("checked");
    fireEvent.click(toggle);

    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy());
    const row = toggle.closest("tr")!;
    expect(row.getAttribute("data-state")).toBe("selected");
    expect(within(row).getByText("Unsaved")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole("link", { name: "Catalog" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Leave without saving?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stay here" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Mark all available" }));
    await waitFor(() =>
      expect(screen.getByText("Everything is already available at Screen Store")).toBeTruthy(),
    );

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getAllByText(/Saved — catalog version/).length).toBe(1));
    await expectNoAxeViolations(container);
  });
});
