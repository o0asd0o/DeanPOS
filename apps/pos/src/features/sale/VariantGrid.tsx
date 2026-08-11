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
    <section
      aria-label={`${item.name} variants`}
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-2"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        {viewMode === "list" ? (
          <SaleList
            items={item.variants}
            onItemSelect={(variant, source) => onVariantSelect(variant.id, source)}
          />
        ) : (
          <div className="grid grid-cols-3 gap-2 md:grid-cols-4 2xl:grid-cols-5">
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
  );
}
