import { Button, Card, CardContent } from "ui";

import { formatPeso } from "./helpers.ts";
import type { SaleMenuItem } from "./types.ts";

type Props = { items: SaleMenuItem[]; onItemSelect: (item: SaleMenuItem) => void };

export function SaleList({ items, onItemSelect }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-2">
        {items.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            disabled={!item.available}
            className="min-h-11 w-full justify-between whitespace-normal"
            onClick={() => onItemSelect(item)}
          >
            <span className="text-left">{item.name}</span>
            <span className="shrink-0 text-muted-foreground">
              {item.available ? formatPeso(item.priceCentavos) : "Sold out"}
            </span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
