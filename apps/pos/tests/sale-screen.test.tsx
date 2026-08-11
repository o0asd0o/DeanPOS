import { expectNoAxeViolations, fireEvent, render, screen } from "api/src/test-seam-react.tsx";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { SaleWorkspace } from "@/features/sale/SaleWorkspace.tsx";

const catalog = {
  categories: [
    { id: "drinks", name: "Drinks" },
    { id: "food", name: "Food" },
  ],
  menuItems: [
    {
      id: "water",
      categoryId: "drinks",
      name: "Water",
      priceCentavos: 2_000,
      available: true,
      variants: [{ id: "bottle", name: "Bottle", priceCentavos: 2_000, available: true }],
      modifierGroups: [],
      addOns: [],
    },
    {
      id: "juice",
      categoryId: "food",
      name: "Juice",
      priceCentavos: 3_000,
      available: true,
      variants: [{ id: "cup", name: "Cup", priceCentavos: 3_000, available: true }],
      modifierGroups: [],
      addOns: [],
    },
    {
      id: "tea",
      categoryId: "drinks",
      name: "Tea",
      priceCentavos: 4_000,
      available: true,
      variants: [{ id: "glass", name: "Glass", priceCentavos: 4_000, available: true }],
      modifierGroups: [],
      addOns: [],
    },
    {
      id: "adobo",
      categoryId: "drinks",
      name: "Adobo",
      priceCentavos: 10_000,
      available: true,
      variants: [
        { id: "half", name: "Half", priceCentavos: 8_000, available: true },
        { id: "whole", name: "Whole", priceCentavos: 12_000, available: false },
      ],
      modifierGroups: [],
      addOns: [],
    },
    {
      id: "rice",
      categoryId: "drinks",
      name: "Rice",
      priceCentavos: 1_500,
      available: true,
      variants: [],
      modifierGroups: [],
      addOns: [],
    },
  ],
  discounts: [],
  version: "0".repeat(64),
};

describe("sale screen", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("builds a three-line order from loaded catalog data without transport and remains accessible", async () => {
    const transport = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("transport must not run while building the order");
    });
    const { container } = render(<SaleWorkspace catalog={catalog} />);

    expect(screen.getByRole("group", { name: "Categories" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Water/ }));
    fireEvent.click(screen.getByRole("button", { name: /Juice/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tea/ }));

    expect(screen.getByText("3 items · ₱90.00 · Open cart")).toBeTruthy();
    expect(screen.getAllByTestId("cart-flight")).toHaveLength(3);
    expect(
      screen.getAllByTestId("cart-flight")[0]?.parentElement?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(transport).not.toHaveBeenCalled();
    expect(localStorage.getItem("deanpos.sale.draft")).toContain("water");
    await expectNoAxeViolations(container);
  });

  it("removes a completed cart flight without changing the order", () => {
    render(<SaleWorkspace catalog={catalog} />);

    fireEvent.click(screen.getByRole("button", { name: /Water/ }));
    const flight = screen.getByTestId("cart-flight");
    fireEvent.animationEnd(flight);

    expect(screen.queryByTestId("cart-flight")).toBeNull();
    expect(screen.getByText("1 items · ₱20.00 · Open cart")).toBeTruthy();
  });

  it("uses the touch-first menu and decisive checkout composition", () => {
    render(<SaleWorkspace catalog={catalog} />);

    expect(screen.getByText("All items")).toBeTruthy();
    expect(screen.getByText("5 items")).toBeTruthy();

    const menu = screen.getByRole("region", { name: "Menu" });
    expect(menu.parentElement?.className).toContain("md:gap-3");
    expect(menu.getAttribute("data-slot")).toBe("card");
    expect(menu.className).toContain("@container/menu");

    const water = screen.getByRole("button", { name: /Water/ });
    expect(water.className).toContain("h-24");
    expect(water.className).toContain("items-start");
    expect(water.className).toContain("justify-between");
    expect(water.className).toContain("p-4");
    expect(water.closest('[data-slot="card"]')).toBe(menu);
    expect(water.parentElement?.className).toContain("grid-cols-1");
    expect(water.parentElement?.className).toContain("@3xs/menu:grid-cols-2");
    expect(water.parentElement?.className).toContain("@sm/menu:grid-cols-3");
    expect(water.parentElement?.className).toContain("@2xl/menu:grid-cols-4");
    expect(water.parentElement?.className).toContain("@4xl/menu:grid-cols-5");

    const allItems = screen.getByRole("button", { name: "All" });
    expect(allItems.className).toContain("h-12");
    expect(allItems.className).toContain("px-5");
    expect(allItems.className).toContain("text-base");

    const cart = screen.getByRole("region", { name: "Current order" });
    expect(cart.className).toContain("w-80");
    expect(cart.className).toContain("gap-0");
    expect(cart.className).toContain("p-0");
    expect(screen.getByText("Your order is empty")).toBeTruthy();
  });

  it("drills into variants, refuses unavailable choices, and category selection returns to the menu", () => {
    render(<SaleWorkspace catalog={catalog} />);

    fireEvent.click(screen.getByRole("button", { name: /Adobo/ }));
    expect(localStorage.getItem("deanpos.sale.draft")).toMatch(/"lines":\[\]/);
    expect(screen.getByRole("button", { name: "Adobo" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Adobo" })).toBeNull();
    expect(screen.getByRole("button", { name: /Whole/ })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "Drinks" }));
    expect(screen.getByRole("button", { name: /Water/ })).toBeTruthy();
  });

  it("adds an optionless selected variant and a menu item without variants", () => {
    render(<SaleWorkspace catalog={catalog} />);

    fireEvent.click(screen.getByRole("button", { name: /Adobo/ }));
    fireEvent.click(screen.getByRole("button", { name: /Half/ }));
    fireEvent.click(screen.getByRole("button", { name: /Rice/ }));

    expect(screen.getByText("2 items · ₱95.00 · Open cart")).toBeTruthy();
    expect(localStorage.getItem("deanpos.sale.draft")).toContain("half");
    expect(localStorage.getItem("deanpos.sale.draft")).toContain("rice");
  });

  it("reveals search, searches across categories, and confirms only a non-empty clear", () => {
    render(<SaleWorkspace catalog={catalog} />);

    fireEvent.click(screen.getByRole("button", { name: "Search menu" }));
    const searchInput = screen.getByRole("textbox", { name: "Search menu" });
    expect(searchInput.closest('[data-slot="card"]')).toBeNull();
    fireEvent.change(searchInput, {
      target: { value: "juice" },
    });
    expect(screen.getByRole("button", { name: /Juice/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Water/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Juice/ }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Clear order" }));
    expect(screen.getByRole("dialog", { name: "Clear this order?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear order" }));
    expect(screen.queryByRole("dialog", { name: "Clear this order?" })).toBeNull();
  });

  it("customizes a required modifier and bounded add-on in an accessible picker", async () => {
    const optionsCatalog = {
      ...catalog,
      menuItems: [
        {
          ...catalog.menuItems[0]!,
          id: "adobo-options",
          name: "Adobo options",
          variants: [{ id: "half-options", name: "Half", priceCentavos: 8_000, available: true }],
          modifierGroups: [
            {
              id: "size",
              name: "Size",
              selectionRule: "required-one" as const,
              maximum: 1,
              defaultModifierId: "regular",
              modifiers: [
                {
                  id: "regular",
                  name: "Regular",
                  delta: { kind: "absolute" as const, amountCentavos: 0 },
                },
              ],
            },
          ],
          addOns: [
            {
              id: "rice",
              name: "Extra rice",
              delta: { kind: "absolute" as const, amountCentavos: 125 },
              maximum: 2,
            },
          ],
        },
      ],
    };
    const { container } = render(<SaleWorkspace catalog={optionsCatalog} />);
    await expectNoAxeViolations(container);
    fireEvent.click(screen.getByRole("button", { name: /Adobo options/ }));
    const dialog = screen.getByRole("dialog", { name: "Adobo options · Half ₱80.00" });
    expect(dialog.className).toContain("sm:max-w-3xl");
    expect(screen.getByText("Choose options for this line.")).toBeTruthy();

    const modifier = screen.getByRole("button", { name: /Regular/ });
    expect(modifier.getAttribute("aria-pressed")).toBe("true");
    expect(modifier.className).toContain("h-12");
    expect(modifier.className).toContain("rounded-xl");
    expect(modifier.className).not.toContain("rounded-full");
    expect(screen.getByText("Size · required")).toBeTruthy();

    const addOnRow = screen.getByText("Extra rice").parentElement;
    expect(addOnRow?.className).toContain("h-14");
    expect(addOnRow?.className).toContain("rounded-xl");
    expect(addOnRow?.className).toContain("bg-muted/60");
    expect(addOnRow?.className).not.toContain("rounded-full");
    await expectNoAxeViolations(dialog);
    fireEvent.click(screen.getByRole("button", { name: "Add one Extra rice" }));
    fireEvent.click(screen.getByRole("button", { name: "Add one Extra rice" }));
    expect(screen.getByRole("button", { name: "Add one Extra rice" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(dialog).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add to order ₱82.50" }));
    expect(screen.getByText("Regular")).toBeTruthy();
    expect(screen.getByText("+ 2× Extra rice")).toBeTruthy();
    expect(screen.getByTestId("cart-flight").textContent).toContain("Adobo options");
  });

  it("edits a plain line through the universal modal and preserves its line id", () => {
    render(<SaleWorkspace catalog={catalog} />);

    fireEvent.click(screen.getByRole("button", { name: /Rice/ }));
    const original = JSON.parse(localStorage.getItem("deanpos.sale.draft")!).lines[0].id;
    fireEvent.click(screen.getByRole("button", { name: /1× Rice/ }));
    expect(screen.getByRole("dialog", { name: /Edit Rice/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Increase Rice quantity" }));
    fireEvent.click(screen.getByRole("button", { name: /Save ₱30\.00/ }));

    const line = JSON.parse(localStorage.getItem("deanpos.sale.draft")!).lines[0];
    expect(line.id).toBe(original);
    expect(line.quantity).toBe(2);
    expect(screen.getByText("1 items · ₱30.00 · Open cart")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /2× Rice/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByText("0 items · ₱0.00 · Open cart")).toBeTruthy();
  });

  it("shows signed option deltas and persists list view", () => {
    const optionsCatalog = {
      ...catalog,
      menuItems: [
        {
          ...catalog.menuItems[0]!,
          name: "Adobo options",
          modifierGroups: [
            {
              id: "portion",
              name: "Portion",
              selectionRule: "optional-one" as const,
              maximum: 1,
              defaultModifierId: null,
              modifiers: [
                { id: "half", name: "Half", delta: { kind: "multiplier" as const, perMille: 500 } },
              ],
            },
          ],
          addOns: [
            {
              id: "rice",
              name: "Extra rice",
              delta: { kind: "absolute" as const, amountCentavos: 1_500 },
              maximum: 1,
            },
          ],
        },
      ],
    };
    const { unmount } = render(<SaleWorkspace catalog={optionsCatalog} />);

    fireEvent.click(screen.getByRole("button", { name: /Adobo options/ }));
    expect(screen.getByRole("button", { name: /Half −₱10\.00/ })).toBeTruthy();
    expect(screen.getByText("Extra rice")).toBeTruthy();
    expect(screen.getByText("+₱15.00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Half −₱10\.00/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add one Extra rice" }));
    expect(screen.getByRole("button", { name: "Add to order ₱25.00" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(screen.getByRole("button", { name: /Adobo options.*₱20\.00/ })).toBeTruthy();
    unmount();
    render(<SaleWorkspace catalog={optionsCatalog} />);
    expect(screen.getByRole("button", { name: /Adobo options.*₱20\.00/ })).toBeTruthy();
  });
});
