import { expectNoAxeViolations, fireEvent, render, screen } from "api/src/test-seam-react.tsx";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { SaleWorkspace } from "@/features/sale/SaleWorkspace.tsx";

const catalog = {
  categories: [{ id: "drinks", name: "Drinks" }],
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
      categoryId: "drinks",
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
    expect(screen.getByRole("heading", { name: "Menu" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Water/ }));
    fireEvent.click(screen.getByRole("button", { name: /Juice/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tea/ }));

    expect(screen.getByText("3 items · ₱90.00 · Open cart")).toBeTruthy();
    expect(transport).not.toHaveBeenCalled();
    expect(localStorage.getItem("deanpos.sale.draft")).toContain("water");
    await expectNoAxeViolations(container);
  });

  it("drills into variants, refuses unavailable choices, and category selection returns to the menu", () => {
    render(<SaleWorkspace catalog={catalog} />);

    fireEvent.click(screen.getByRole("button", { name: /Adobo/ }));
    expect(localStorage.getItem("deanpos.sale.draft")).toMatch(/"lines":\[\]/);
    expect(screen.getByRole("button", { name: /Adobo — choose a variant/ })).toBeTruthy();
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

  it("searches by name and confirms only a non-empty clear", () => {
    render(<SaleWorkspace catalog={catalog} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search menu" }), {
      target: { value: "water" },
    });
    expect(screen.getByRole("button", { name: /Water/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Juice/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Water/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear order" }));
    expect(screen.getByRole("dialog", { name: "Clear this order?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear order" }));
    expect(screen.queryByRole("dialog", { name: "Clear this order?" })).toBeNull();
  });
});
