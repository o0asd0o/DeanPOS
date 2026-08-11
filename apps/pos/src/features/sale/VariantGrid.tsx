import { Card } from "ui";

import { SaleGridBottomBar } from "./SaleGridBottomBar.tsx";
import { SaleList } from "./SaleList.tsx";
import { SaleTile } from "./SaleTile.tsx";
import type { SaleMenuItem } from "./types.ts";
import type { ViewMode } from "./view-mode.ts";

type Props = {
  item: SaleMenuItem;
  categories: { id: string; name: string }[];
  selectedCategoryId: string | null;
  viewMode: ViewMode;
  onCategorySelect: (categoryId: string | null) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  onVariantSelect: (variantId: string, source: HTMLButtonElement) => void;
};

export function VariantGrid({
  item,
  categories,
  selectedCategoryId,
  viewMode,
  onCategorySelect,
  onViewModeChange,
  onVariantSelect,
}: Props) {
  return (
    <Card
      aria-label={`${item.name} variants`}
      role="region"
      className="@container/menu min-h-0 min-w-0 flex-1 gap-0 overflow-hidden rounded-2xl py-0"
    >
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-2 md:p-3">
          {viewMode === "list" ? (
            <SaleList
              items={item.variants}
              onItemSelect={(variant, source) => onVariantSelect(variant.id, source)}
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 @3xs/menu:grid-cols-2 @sm/menu:grid-cols-3 @2xl/menu:grid-cols-4 @4xl/menu:grid-cols-5">
              {item.variants.map((variant) => (
                <SaleTile
                  key={variant.id}
                  name={variant.name}
                  priceCentavos={variant.priceCentavos}
                  available={variant.available}
                  onSelect={(source) => onVariantSelect(variant.id, source)}
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
