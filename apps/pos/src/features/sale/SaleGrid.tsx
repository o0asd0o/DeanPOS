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
    <section aria-label="Menu" className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {viewMode === "list" ? (
          <SaleList items={items} onItemSelect={onItemSelect} />
        ) : (
          <div className="grid grid-cols-3 gap-2 md:grid-cols-4 2xl:grid-cols-5">
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
  );
}
