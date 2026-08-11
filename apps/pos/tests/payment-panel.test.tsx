import { expectNoAxeViolations, fireEvent, render, screen } from "api/src/test-seam-react.tsx";
import { describe, expect, it, vi } from "vite-plus/test";

import { PaymentPanel } from "@/features/payment/PaymentPanel.tsx";

const draft = {
  id: "10000000-0000-4000-8000-000000000001",
  lines: [
    {
      id: "line-1",
      menuItemId: "10000000-0000-4000-8000-000000000002",
      menuItemName: "Adobo",
      variantId: "10000000-0000-4000-8000-000000000003",
      variantName: "Whole",
      unitPriceCentavos: 30_800,
      quantity: 1,
      modifierIds: [],
      addOnIds: [],
      totalCentavos: 30_800,
    },
  ],
  totalCentavos: 30_800,
};

const catalog = {
  categories: [{ id: "food", name: "Food" }],
  menuItems: [
    {
      id: draft.lines[0].menuItemId,
      categoryId: "food",
      name: "Adobo",
      priceCentavos: 30_800,
      available: true,
      variants: [
        {
          id: draft.lines[0].variantId,
          name: "Whole",
          priceCentavos: 30_800,
          available: true,
        },
      ],
      modifierGroups: [],
      addOns: [],
    },
  ],
};

describe("PaymentPanel", () => {
  it("renders the cash-only amount due, summary, and both responsive layout seams", async () => {
    const { container } = render(
      <PaymentPanel
        draft={draft}
        catalog={catalog}
        pending={false}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getAllByText("₱308.00").length).toBeGreaterThan(1);
    expect(screen.getByRole("region", { name: "Payment" }).className).toContain("md:grid-cols-2");
    expect(screen.queryByText("Payment method")).toBeNull();
    expect(screen.queryByText("Discount")).toBeNull();
    expect(screen.queryByText("VAT")).toBeNull();
    await expectNoAxeViolations(container);
  });

  it("sets quick tender, calculates change, and submits centavos", () => {
    const onSubmit = vi.fn();
    render(
      <PaymentPanel
        draft={draft}
        catalog={catalog}
        pending={false}
        onBack={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const complete = screen.getByRole("button", { name: "Complete sale" });
    expect(complete).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Tender ₱500" }));
    expect(screen.getByRole("textbox", { name: "Cash tendered" })).toHaveProperty("value", "500");
    expect(screen.getByText("₱192.00")).toBeTruthy();
    expect(complete).toHaveProperty("disabled", false);
    fireEvent.click(complete);
    expect(onSubmit).toHaveBeenCalledWith(50_000);
  });

  it("supports exact cash, refuses underpayment, and disables while pending", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <PaymentPanel
        draft={draft}
        catalog={catalog}
        pending={false}
        onBack={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Cash tendered" });
    fireEvent.change(input, { target: { value: "300" } });
    expect(screen.getByRole("button", { name: "Complete sale" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Tender exact amount" }));
    expect(input).toHaveProperty("value", "308");
    expect(screen.getByRole("button", { name: "Complete sale" })).toHaveProperty("disabled", false);

    rerender(
      <PaymentPanel draft={draft} catalog={catalog} pending onBack={vi.fn()} onSubmit={onSubmit} />,
    );
    expect(screen.getByRole("button", { name: "Completing sale…" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
