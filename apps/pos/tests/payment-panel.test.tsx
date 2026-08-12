import { readFileSync } from "node:fs";
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
  vatEnabled: true,
  vatRatePercent: 12,
};

const configuredCatalog = {
  ...catalog,
  paymentMethods: [
    ...catalog.paymentMethods,
    { id: "gcash-id", name: "GCash", kind: "recorded" as const },
    { id: "maya-id", name: "Maya", kind: "recorded" as const },
    { id: "card-id", name: "Card", kind: "recorded" as const },
  ],
};

function readPngSize(path: string) {
  const png = readFileSync(path);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe("PaymentPanel", () => {
  it("keeps both brand marks proportionally padded inside their pills", () => {
    expect(readPngSize("src/assets/gcash-brand-mark.png")).toEqual({ width: 780, height: 306 });
    expect(readPngSize("src/assets/maya-brand-mark.png")).toEqual({ width: 560, height: 220 });
  });

  it("switches selected branding without a reveal animation", () => {
    const styles = readFileSync("src/styles.css", "utf8");
    expect(styles).not.toContain("payment-brand-reveal");
    expect(styles).not.toContain("clip-path");
  });

  it("keeps the order total fixed, scrolls only order lines, and shows included VAT", async () => {
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
    expect(screen.getByText("VAT (12%)")).toBeTruthy();
    expect(screen.getByText("₱33.00")).toBeTruthy();
    expect(screen.getByLabelText("Order lines").className).toContain("overflow-y-auto");
    expect(screen.getByText("Total").parentElement?.className).toContain("mt-auto");
    const payment = screen.getByRole("region", { name: "Payment" });
    expect(payment.className).toContain("@container/payment");
    expect(
      screen.getByText("Order summary").closest('[data-slot="card"]')?.parentElement?.className,
    ).toContain("@3xl/payment:grid-cols-3");
    expect(screen.getByRole("group", { name: "Quick tender" }).className).toContain(
      "@xs/tender:grid-cols-3",
    );
    expect(screen.getByRole("textbox", { name: "Cash tendered" }).className).toContain("text-3xl");
    expect(screen.queryByText("Payment method")).toBeNull();
    expect(screen.queryByText("Discount")).toBeNull();
    await expectNoAxeViolations(container);
  });

  it("omits the VAT row for a non-VAT tenant", () => {
    render(
      <PaymentPanel
        draft={draft}
        catalog={{ ...catalog, vatEnabled: false }}
        pending={false}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByText(/VAT \(/)).toBeNull();
  });

  it("adds quick tender presets, calculates change, and submits centavos", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Clear cash tendered" }));
    expect(screen.getByRole("textbox", { name: "Cash tendered" })).toHaveProperty("value", "");
    expect(screen.queryByRole("button", { name: "Clear cash tendered" })).toBeNull();
    expect(complete).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Tender ₱500" }));
    fireEvent.click(screen.getByRole("button", { name: "Tender ₱100" }));
    expect(screen.getByRole("textbox", { name: "Cash tendered" })).toHaveProperty("value", "600");
    expect(screen.getByText("₱292.00")).toBeTruthy();
    expect(complete).toHaveProperty("disabled", false);
    fireEvent.click(complete);
    expect(onSubmit).toHaveBeenCalledWith("cash-id", 60_000);
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

    const chooser = screen.getByRole("group", { name: "Payment method" });
    expect(chooser).toBeTruthy();
    expect(chooser.parentElement?.className).toContain("@xl/tender:grid-cols-3");
    expect(chooser.className).toContain("@xl/tender:col-span-2");
    expect(chooser.lastElementChild?.className).toContain("flex-nowrap");
    expect(chooser.lastElementChild?.className).toContain("overflow-x-auto");
    const gcash = screen.getByRole("button", { name: "GCash" });
    const maya = screen.getByRole("button", { name: "Maya" });
    expect(gcash.textContent).toBe("GCash");
    expect(maya.textContent).toBe("Maya");
    expect(gcash.querySelector("img")).toBeNull();
    expect(maya.querySelector("img")).toBeNull();
    expect(gcash.className).toContain("min-w-28");
    expect(gcash.className).toContain("transition-[color,box-shadow,border-color]");
    expect(gcash.className).not.toContain("transition-all");
    expect(screen.getByRole("button", { name: "Card" }).querySelector("img")).toBeNull();
    expect(gcash.className).toContain("aria-pressed:ring-2");
    expect(screen.getByRole("button", { name: "Cash" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(maya);
    expect(maya.getAttribute("aria-pressed")).toBe("true");
    expect(maya.textContent).toBe("");
    expect(maya.querySelector("img")?.getAttribute("src")).toContain("maya-brand-mark.png");
    expect(gcash.textContent).toBe("GCash");
    expect(gcash.querySelector("img")).toBeNull();
    fireEvent.click(gcash);
    expect(gcash.getAttribute("aria-pressed")).toBe("true");
    expect(gcash.textContent).toBe("");
    expect(gcash.querySelector("img")?.getAttribute("src")).toContain("gcash-brand-mark.png");
    expect(gcash.className).toContain("w-28");
    expect(gcash.className).toContain("overflow-hidden");
    expect(gcash.className).toContain("p-0");
    expect(gcash.querySelector("img")?.className).toContain("h-full");
    expect(gcash.querySelector("img")?.className).toContain("w-full");
    expect(gcash.querySelector("img")?.className).toContain("object-cover");
    expect(gcash.querySelector("img")?.className).not.toContain("payment-brand-reveal");
    expect(maya.textContent).toBe("Maya");
    expect(maya.querySelector("img")).toBeNull();

    expect(screen.queryByRole("textbox", { name: "Cash tendered" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Quick tender" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Change" })).toBeNull();
    expect(screen.getByText(/authorises nothing/i)).toBeTruthy();

    const amount = screen.getByRole("textbox", { name: "Amount recorded" });
    expect(amount).toHaveProperty("value", "308");
    expect(screen.getByRole("button", { name: "Complete sale" })).toHaveProperty("disabled", false);
    fireEvent.change(amount, { target: { value: "309" } });
    expect(screen.getByRole("button", { name: "Complete sale" })).toHaveProperty("disabled", true);
    fireEvent.change(amount, { target: { value: "308" } });
    fireEvent.click(screen.getByRole("button", { name: "Complete sale" }));
    expect(onSubmit).toHaveBeenCalledWith("gcash-id", 30_800);
    await expectNoAxeViolations(container);
  });

  it("keeps change immediately above the fixed action area", () => {
    render(
      <PaymentPanel
        draft={draft}
        catalog={catalog}
        pending={false}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const paymentCard = screen
      .getByRole("heading", { name: "Amount due" })
      .closest('[data-slot="card"]');
    expect(paymentCard?.className).toContain("flex");
    expect(screen.getByRole("heading", { name: "Change" }).parentElement?.parentElement?.className).toContain(
      "mt-auto",
    );
  });
});
