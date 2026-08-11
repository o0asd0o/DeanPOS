import { Button } from "ui";

import { formatPeso } from "@/features/helpers.ts";

type SaleListItem = {
  id: string;
  name: string;
  priceCentavos: number;
  available: boolean;
};

type Props<Item extends SaleListItem> = {
  items: Item[];
  onItemSelect: (item: Item, source: HTMLButtonElement) => void;
};

export function SaleList<Item extends SaleListItem>({ items, onItemSelect }: Props<Item>) {
  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant="ghost"
          disabled={!item.available}
          className="h-12 justify-between rounded-lg bg-muted/60 px-4 text-base"
          onClick={(event) => onItemSelect(item, event.currentTarget)}
        >
          <span className="truncate">{item.name}</span>
          <span className="text-sm text-muted-foreground">
            {item.available ? formatPeso(item.priceCentavos) : "Sold out"}
          </span>
        </Button>
      ))}
    </div>
  );
}
