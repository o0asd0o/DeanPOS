import { Button } from "ui";

import type { SalePaymentMethod } from "@/features/sale/types.ts";

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
        {methods.map((method) => (
          <Button
            key={method.id}
            type="button"
            variant="outline"
            aria-pressed={method.id === selectedId}
            onClick={() => onSelect(method.id)}
          >
            {method.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
