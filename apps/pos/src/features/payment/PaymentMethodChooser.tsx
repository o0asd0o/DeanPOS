import { Button } from "ui";

import type { SalePaymentMethod } from "@/features/sale/types.ts";
import { getPaymentMethodBrand } from "./helpers.ts";
import { PaymentMethodMark } from "./PaymentMethodMark.tsx";

type Props = {
  methods: SalePaymentMethod[];
  selectedId: string;
  onSelect: (methodId: string) => void;
};

export function PaymentMethodChooser({ methods, selectedId, onSelect }: Props) {
  return (
    <div aria-label="Payment method" role="group" className="grid gap-2">
      <span className="text-sm font-medium text-muted-foreground">Payment method</span>
      <div className="flex flex-wrap gap-2">
        {methods.map((method) => {
          const brand = getPaymentMethodBrand(method.name);
          return (
            <Button
              key={method.id}
              type="button"
              variant="outline"
              className="aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-2"
              aria-label={method.name}
              aria-pressed={method.id === selectedId}
              onClick={() => onSelect(method.id)}
            >
              {brand ? <PaymentMethodMark brand={brand} /> : method.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
