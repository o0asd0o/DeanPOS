import { Badge, Button, Card, CardContent } from "ui";

import { CategoryTabs } from "./CategoryTabs.tsx";
import { formatPeso } from "./helpers.ts";
import type { SaleMenuItem } from "./types.ts";

type Props = {
  item: SaleMenuItem;
  categories: { id: string; name: string }[];
  onBack: () => void;
  onCategorySelect: (categoryId: string | null) => void;
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
      className="flex min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4"
    >
      <Card>
        <CardContent className="flex flex-col gap-3 pt-0">
          <CategoryTabs
            categories={categories}
            selectedCategoryId={item.categoryId}
            onCategorySelect={onCategorySelect}
          />
          <Button type="button" variant="ghost" className="justify-start" onClick={onBack}>
            ‹ {item.name} — choose a variant
          </Button>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between px-3 sm:px-4">
        <h2 className="text-base font-semibold">{item.name}</h2>
        <Badge variant="secondary">{item.variants.length} choices</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {item.variants.map((variant) => (
          <Card key={variant.id} className="min-h-32 py-0">
            <CardContent className="flex h-full p-0">
              <Button
                type="button"
                variant="ghost"
                disabled={!variant.available}
                className="h-full min-h-32 w-full flex-col gap-2 rounded-xl whitespace-normal hover:bg-transparent hover:text-foreground hover:shadow-xs"
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
    </section>
  );
}
