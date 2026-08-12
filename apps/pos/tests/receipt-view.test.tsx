import { expectNoAxeViolations, fireEvent, render, screen } from "api/src/test-seam-react.tsx";
import { describe, expect, it, vi } from "vite-plus/test";

import { ReceiptView } from "@/features/receipt/ReceiptView.tsx";

const receipt = {
  orderId: "10000000-0000-4000-8000-000000000001",
  orderNumber: "C2-0421",
  deviceCode: "C2",
  deviceName: "Counter 2",
  cashierUserId: "10000000-0000-4000-8000-000000000006",
  cashierName: "Ana Reyes",
  paymentMethodId: "10000000-0000-4000-8000-000000000007",
  paymentMethodName: "Cash",
  paymentMethodKind: "cash" as const,
  totalCentavos: 25_500,
  vatRatePercent: null,
  amountTenderedCentavos: 30_000,
  changeCentavos: 4_500,
  lines: [
    {
      menuItemName: "Adobo",
      variantName: "Whole",
      unitPriceCentavos: 12_000,
      quantity: 2,
      lineTotalCentavos: 25_500,
      modifiers: [{ id: "modifier", name: "Spicy", deltaKind: "absolute" as const, deltaValue: 0 }],
      addOns: [
        {
          id: "addon",
          name: "Extra rice",
          deltaKind: "absolute" as const,
          deltaValue: 750,
        },
      ],
    },
  ],
};

const recordedReceipt = {
  ...receipt,
  paymentMethodName: "GCash",
  paymentMethodKind: "recorded" as const,
  amountTenderedCentavos: 25_500,
  changeCentavos: 0,
};

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event("resize"));
}

describe("ReceiptView", () => {
  it("confirms completion, itemises snapshots, omits future rows, and starts the next Order", async () => {
    const onNewOrder = vi.fn();
    setViewport(1280, 800);
    const { container } = render(<ReceiptView receipt={receipt} onNewOrder={onNewOrder} />);

    expect(screen.getByRole("region", { name: "Receipt" })).toBeTruthy();
    expect(screen.getByText("Sale complete")).toBeTruthy();
    expect(screen.getByText("Order C2-0421")).toBeTruthy();
    expect(screen.getByText("Device C2 · Counter 2")).toBeTruthy();
    expect(screen.getByText("Cashier · Ana Reyes")).toBeTruthy();
    expect(screen.getByText("Payment method · Cash")).toBeTruthy();
    expect(screen.getByText("Adobo · Whole ×2")).toBeTruthy();
    expect(screen.getByText("Modifier · Spicy")).toBeTruthy();
    expect(screen.getByText("Add-on · Extra rice")).toBeTruthy();
    expect(screen.getAllByText("₱255.00")).toHaveLength(2);
    expect(screen.getByText("₱300.00")).toBeTruthy();
    expect(screen.getByText("₱45.00")).toBeTruthy();
    expect(screen.queryByText(/VAT/i)).toBeNull();
    expect(screen.queryByText(/Discount/i)).toBeNull();
    await expectNoAxeViolations(container);

    setViewport(390, 844);
    await expectNoAxeViolations(container);

    fireEvent.click(screen.getByRole("button", { name: "New order" }));
    expect(onNewOrder).toHaveBeenCalledOnce();
  });

  it("identifies a recorded tender and omits cash-only change details", () => {
    render(<ReceiptView receipt={recordedReceipt} onNewOrder={vi.fn()} />);

    expect(screen.getByText("GCASH · PAID")).toBeTruthy();
    expect(screen.getByText("Payment method · GCash")).toBeTruthy();
    expect(screen.getByText("Amount paid")).toBeTruthy();
    expect(screen.queryByText("Amount tendered")).toBeNull();
    expect(screen.queryByText("Change")).toBeNull();
  });

  it("shows the captured discount name and amount", () => {
    render(
      <ReceiptView
        receipt={{
          ...receipt,
          discount: { name: "Senior discount", amountCentavos: 2_550 },
        }}
        onNewOrder={vi.fn()}
      />,
    );

    expect(screen.getByText("Discount · Senior discount")).toBeTruthy();
    expect(screen.getByText("−₱25.50")).toBeTruthy();
  });

  it("shows VAT from the saved rate only when VAT was enabled for the sale", async () => {
    const { container } = render(
      <ReceiptView
        receipt={{ ...receipt, totalCentavos: 38_500, vatRatePercent: 12 }}
        onNewOrder={vi.fn()}
      />,
    );

    expect(screen.getByText("VAT (12%)")).toBeTruthy();
    expect(screen.getByText("₱41.25")).toBeTruthy();
    expect(
      screen.getByText("VAT (12%)").compareDocumentPosition(screen.getByText("Total")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});
