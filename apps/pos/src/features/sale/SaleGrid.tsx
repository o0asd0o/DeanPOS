import { SearchXIcon } from "lucide-react";
import { Card } from "ui";

import { SaleGridBottomBar } from "./SaleGridBottomBar.tsx";
import { SaleList } from "./SaleList.tsx";
import { SaleTile } from "./SaleTile.tsx";
import type { SaleMenuItem } from "./types.ts";
import type { ViewMode } from "./view-mode.ts";

type Props = {
  categories: { id: string; name: string }[];
  items: SaleMenuItem[];
  selectedCategoryId: string | null;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  onCategorySelect: (categoryId: string | null) => void;
  onItemSelect: (item: SaleMenuItem, source: HTMLButtonElement) => void;
};

export function SaleGrid({
  categories,
  items,
  selectedCategoryId,
  viewMode,
  onViewModeChange,
  onCategorySelect,
  onItemSelect,
}: Props) {
  return (
    <Card
      aria-label="Menu"
      role="region"
      className="@container/menu min-h-0 min-w-0 flex-1 gap-0 overflow-hidden rounded-2xl py-0"
    >
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-2 md:p-3">
          {items.length === 0 ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <SearchXIcon aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="font-semibold">No menu items found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try another category or search term.
                </p>
              </div>
            </div>
          ) : viewMode === "list" ? (
            <SaleList items={items} onItemSelect={onItemSelect} />
          ) : (
            <div className="grid grid-cols-1 gap-2 @3xs/menu:grid-cols-2 @sm/menu:grid-cols-3 @2xl/menu:grid-cols-4 @4xl/menu:grid-cols-5">
              {items.map((item) => (
                <SaleTile
                  key={item.id}
                  name={item.name}
                  priceCentavos={item.priceCentavos}
                  available={item.available}
                  onSelect={(source) => onItemSelect(item, source)}
                />
              ))}
            </div>
          )}
        </div>
        <SaleGridBottomBar
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          viewMode={viewMode}
          onCategorySelect={onCategorySelect}
          onViewModeChange={onViewModeChange}
        />
      </section>
    </Card>
  );
}
