import { Button, Card, CardContent } from "ui";

import { formatPeso } from "./helpers.ts";
import { SaleGridBottomBar } from "./SaleGridBottomBar.tsx";
import type { SaleMenuItem } from "./types.ts";
import type { ViewMode } from "./view-mode.ts";

type Props = {
  item: SaleMenuItem;
  categories: { id: string; name: string }[];
  viewMode: ViewMode;
  onCategorySelect: (categoryId: string | null) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  onVariantSelect: (variantId: string) => void;
};

export function VariantGrid({
  item,
  categories,
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
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
          {item.variants.map((variant) => (
            <Card key={variant.id} className="min-h-11 py-0">
              <CardContent className="flex h-full p-0">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!variant.available}
                  className="min-h-20 w-full flex-col gap-1 rounded-xl whitespace-normal hover:bg-transparent hover:text-foreground hover:shadow-xs"
                  onClick={() => onVariantSelect(variant.id)}
                >
                  <span>{variant.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {variant.available ? formatPeso(variant.priceCentavos) : "Sold out"}
                  </span>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <SaleGridBottomBar
        categories={categories}
        selectedCategoryId={item.categoryId}
        viewMode={viewMode}
        onCategorySelect={onCategorySelect}
        onViewModeChange={onViewModeChange}
      />
    </section>
  );
}
