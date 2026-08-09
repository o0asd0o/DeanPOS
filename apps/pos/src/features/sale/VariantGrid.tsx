import { Card, CardContent } from "ui";

import { formatPeso } from "./helpers.ts";
import type { SaleMenuItem } from "./types.ts";

type Props = {
  item: SaleMenuItem;
  categories: { id: string; name: string }[];
  onBack: () => void;
  onCategorySelect: (categoryId: string) => void;
  onVariantSelect: (variantId: string) => void;
};

export function VariantGrid({
  item,
  categories,
  onBack,
  onCategorySelect,
  onVariantSelect,
}: Props) {
  return (
    <section
      aria-label={`${item.name} variants`}
      className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4"
    >
      <div
        aria-label="Categories"
        className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible"
      >
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className="min-h-11 shrink-0 text-left"
            onClick={() => onCategorySelect(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
      <button type="button" className="min-h-11 text-left font-medium" onClick={onBack}>
        ‹ {item.name} — choose a variant
      </button>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {item.variants.map((variant) => (
          <Card key={variant.id} className="min-h-28">
            <CardContent className="flex h-full p-0">
              <button
                type="button"
                disabled={!variant.available}
                className="flex min-h-28 w-full flex-col items-center justify-center gap-1 p-3 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onVariantSelect(variant.id)}
              >
                <span className="font-medium">{variant.name}</span>
                <span className="text-sm text-muted-foreground">
                  {variant.available ? formatPeso(variant.priceCentavos) : "Sold out"}
                </span>
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
