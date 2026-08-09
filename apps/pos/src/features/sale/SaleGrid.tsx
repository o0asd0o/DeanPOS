import { Badge, Button, Card, CardAction, CardContent, CardHeader, CardTitle, Input } from "ui";

import { CategoryTabs } from "./CategoryTabs.tsx";
import { formatPeso } from "./helpers.ts";
import type { SaleMenuItem } from "./types.ts";

type Props = {
  categories: { id: string; name: string }[];
  items: SaleMenuItem[];
  search: string;
  selectedCategoryId: string | null;
  onSearchChange: (value: string) => void;
  onCategorySelect: (categoryId: string | null) => void;
  onItemSelect: (item: SaleMenuItem) => void;
};

export function SaleGrid({
  categories,
  items,
  search,
  selectedCategoryId,
  onSearchChange,
  onCategorySelect,
  onItemSelect,
}: Props) {
  return (
    <section aria-label="Menu" className="flex min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-0">
          <Input
            aria-label="Search menu"
            placeholder="Search menu…"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <CategoryTabs
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onCategorySelect={onCategorySelect}
          />
        </CardContent>
      </Card>
      <Card className="flex-1">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Menu
          </CardTitle>
          <CardAction>
            <Badge variant="secondary">{items.length} items</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => (
            <Card key={item.id} className="min-h-32 py-0">
              <CardContent className="flex h-full p-0">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!item.available}
                  className="h-full min-h-32 w-full flex-col gap-2 whitespace-normal"
                  onClick={() => onItemSelect(item)}
                >
                  <span>{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.available ? formatPeso(item.priceCentavos) : "Sold out"}
                  </span>
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
