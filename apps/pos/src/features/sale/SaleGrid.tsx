import { Card, CardContent, Input } from "ui";

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
    <section aria-label="Menu" className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      <Input
        aria-label="Search menu"
        placeholder="Search menu…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div
        aria-label="Categories"
        className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible"
      >
        <button
          type="button"
          className="min-h-11 shrink-0 text-left"
          aria-pressed={selectedCategoryId === null}
          onClick={() => onCategorySelect(null)}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className="min-h-11 shrink-0 text-left"
            aria-pressed={selectedCategoryId === category.id}
            onClick={() => onCategorySelect(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id} className="min-h-28">
            <CardContent className="flex h-full p-0">
              <button
                type="button"
                disabled={!item.available}
                className="flex min-h-28 w-full flex-col items-center justify-center gap-1 p-3 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onItemSelect(item)}
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-sm text-muted-foreground">
                  {item.available ? formatPeso(item.priceCentavos) : "Sold out"}
                </span>
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
