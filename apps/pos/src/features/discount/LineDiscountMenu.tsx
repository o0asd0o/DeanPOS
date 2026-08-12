import { CheckIcon, PercentIcon } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "ui";

import type { SaleDiscount } from "@/features/sale/types.ts";

type Props = {
  discounts: SaleDiscount[];
  lineName: string;
  selectedId: string | null;
  onSelect: (discountId: string | null) => void;
};

export function LineDiscountMenu({ discounts, lineName, selectedId, onSelect }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={selectedId === null ? "outline" : "default"}
          size="icon-sm"
          aria-label={
            selectedId === null
              ? `Apply line discount to ${lineName}`
              : `Change line discount for ${lineName}`
          }
          title={selectedId === null ? "Apply line discount" : "Change line discount"}
          className="shrink-0 bg-secondary text-card-foreground shadow-none"
        >
          <PercentIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>Line discount</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onSelect(null)}>
          <span className="flex-1">No discount</span>
          {selectedId === null ? <CheckIcon aria-hidden="true" /> : null}
        </DropdownMenuItem>
        {discounts.map((discount) => (
          <DropdownMenuItem key={discount.id} onSelect={() => onSelect(discount.id)}>
            <span className="flex-1">{discount.name}</span>
            {selectedId === discount.id ? <CheckIcon aria-hidden="true" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
