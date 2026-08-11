import { Button } from "ui";

import { formatPeso } from "./helpers.ts";

type SaleListItem = {
  id: string;
  name: string;
  priceCentavos: number;
  available: boolean;
};

type Props<Item extends SaleListItem> = {
  items: Item[];
  onItemSelect: (item: Item) => void;
};

export function SaleList<Item extends SaleListItem>({ items, onItemSelect }: Props<Item>) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-card">
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant="ghost"
          disabled={!item.available}
          className="h-12 justify-between rounded-none border-b border-border px-4 text-base last:border-b-0"
          onClick={() => onItemSelect(item)}
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
