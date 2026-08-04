import { cleanup, fireEvent, render, screen } from "api/src/test-seam-react.tsx";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { PaymentMethodNameField } from "@/features/payment-methods/PaymentMethodNameField.tsx";

function renderField(value: string) {
  let current = value;
  const field = () => (
    <PaymentMethodNameField
      name="name"
      value={current}
      onChange={(next) => {
        current = next;
        view.rerender(field());
      }}
      onBlur={() => undefined}
    />
  );
  const view = render(field());
  return {
    get value() {
      return current;
    },
  };
}

describe("the payment method Name field", () => {
  afterEach(cleanup);

  it("suggests presets on focus, filters as you type, and keeps free text", () => {
    const field = renderField("");
    const input = screen.getByLabelText("Name");

    fireEvent.focus(input);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Card",
      "GCash",
      "Maya",
      "Bank transfer",
    ]);

    fireEvent.change(input, { target: { value: "ca" } });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Card",
      "GCash",
    ]);

    fireEvent.click(screen.getByRole("option", { name: "GCash" }));
    expect(field.value).toBe("GCash");
    // An exact preset match has nothing left to suggest.
    expect(screen.queryAllByRole("option")).toEqual([]);

    fireEvent.change(input, { target: { value: "Bank Transfer (Local)" } });
    expect(field.value).toBe("Bank Transfer (Local)");
  });
});
