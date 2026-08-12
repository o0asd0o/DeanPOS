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
  paymentMethods: [{ id: "cash-id", name: "Cash", kind: "cash" as const }],
};

const configuredCatalog = {
  ...catalog,
  paymentMethods: [
    ...catalog.paymentMethods,
    { id: "gcash-id", name: "GCash", kind: "recorded" as const },
    { id: "card-id", name: "Card", kind: "recorded" as const },
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
    expect(screen.getAllByText("Amount due")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Amount due" }).parentElement?.className).toContain(
      "bg-secondary",
    );
    expect(screen.getByText("Total")).toBeTruthy();
    const payment = screen.getByRole("region", { name: "Payment" });
    expect(payment.className).toContain("@container/payment");
    expect(
      screen.getByText("Order summary").closest('[data-slot="card"]')?.parentElement?.className,
    ).toContain("@3xl/payment:grid-cols-3");
    expect(screen.getByRole("group", { name: "Quick tender" }).className).toContain(
      "@xs/tender:grid-cols-3",
    );
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
    expect(onSubmit).toHaveBeenCalledWith("cash-id", 50_000);
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

  it("shows an explicit Device sequence refusal", () => {
    render(
      <PaymentPanel
        draft={draft}
        catalog={catalog}
        pending={false}
        error="This Device cannot assign another Order number. Contact an administrator."
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "This Device cannot assign another Order number",
    );
  });

  it("chooses a recorded method while removing every cash-only control and retaining the warning", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <PaymentPanel
        draft={draft}
        catalog={configuredCatalog}
        pending={false}
        onBack={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("group", { name: "Payment method" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cash" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "GCash" }));

    expect(screen.queryByRole("textbox", { name: "Cash tendered" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Quick tender" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Change" })).toBeNull();
    expect(screen.getByText(/authorises nothing/i)).toBeTruthy();

    const amount = screen.getByRole("textbox", { name: "Amount recorded" });
    fireEvent.change(amount, { target: { value: "309" } });
    expect(screen.getByRole("button", { name: "Complete sale" })).toHaveProperty("disabled", true);
    fireEvent.change(amount, { target: { value: "308" } });
    fireEvent.click(screen.getByRole("button", { name: "Complete sale" }));
    expect(onSubmit).toHaveBeenCalledWith("gcash-id", 30_800);
    await expectNoAxeViolations(container);
  });
});
