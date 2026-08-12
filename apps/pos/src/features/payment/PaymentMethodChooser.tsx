import { Button, cn } from "ui";

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
    <div
      aria-label="Payment method"
      role="group"
      className="grid min-w-0 gap-2 @xl/tender:col-span-2"
    >
      <span className="text-sm font-medium text-muted-foreground">Payment method</span>
      <div className="flex flex-nowrap gap-2 overflow-x-auto py-1">
        {methods.map((method) => {
          const brand = getPaymentMethodBrand(method.name);
          const selected = method.id === selectedId;
          return (
            <Button
              key={method.id}
              type="button"
              variant="outline"
              className={cn(
                "aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-2",
                brand && selected && "w-28 overflow-hidden p-0",
              )}
              aria-label={method.name}
              aria-pressed={selected}
              onClick={() => onSelect(method.id)}
            >
              {brand && selected ? <PaymentMethodMark brand={brand} /> : method.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
