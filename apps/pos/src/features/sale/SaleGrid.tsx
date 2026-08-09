import { Button, Card, CardContent, Input } from "ui";

import { formatPeso } from "./helpers.ts";
import { SaleGridBottomBar } from "./SaleGridBottomBar.tsx";
import { SaleList } from "./SaleList.tsx";
import type { SaleMenuItem } from "./types.ts";
import type { ViewMode } from "./view-mode.ts";

type Props = {
  categories: { id: string; name: string }[];
  items: SaleMenuItem[];
  search: string;
  searchOpen: boolean;
  selectedCategoryId: string | null;
  viewMode: ViewMode;
  onSearchChange: (value: string) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  onCategorySelect: (categoryId: string | null) => void;
  onItemSelect: (item: SaleMenuItem) => void;
};

export function SaleGrid({
  categories,
  items,
  search,
  searchOpen,
  selectedCategoryId,
  viewMode,
  onSearchChange,
  onViewModeChange,
  onCategorySelect,
  onItemSelect,
}: Props) {
  return (
    <section aria-label="Menu" className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      {searchOpen && (
        <Card>
          <CardContent className="p-2">
            <Input
              aria-label="Search menu"
              placeholder="Search menu…"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </CardContent>
        </Card>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {viewMode === "list" ? (
          <SaleList items={items} onItemSelect={onItemSelect} />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
            {items.map((item) => (
              <Card key={item.id} className="min-h-11 py-0">
                <CardContent className="flex h-full p-0">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!item.available}
                    className="min-h-20 w-full flex-col gap-1 rounded-xl whitespace-normal hover:bg-transparent hover:text-foreground hover:shadow-xs"
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
