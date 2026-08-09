import { Button, Card, CardContent } from "ui";

import { CategoryTabs } from "./CategoryTabs.tsx";
import type { ViewMode } from "./view-mode.ts";

type Props = {
  categories: { id: string; name: string }[];
  selectedCategoryId: string | null;
  viewMode: ViewMode;
  onCategorySelect: (categoryId: string | null) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
};

export function SaleGridBottomBar({
  categories,
  selectedCategoryId,
  viewMode,
  onCategorySelect,
  onViewModeChange,
}: Props) {
  const nextViewMode = viewMode === "tile" ? "list" : "tile";
  return (
    <Card>
      <CardContent className="flex items-center gap-2 p-2">
        <div className="min-w-0 flex-1">
          <CategoryTabs
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onCategorySelect={onCategorySelect}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={nextViewMode === "list" ? "List view" : "Tile view"}
          onClick={() => onViewModeChange(nextViewMode)}
        >
          {nextViewMode === "list" ? "☰" : "▦"}
        </Button>
      </CardContent>
    </Card>
  );
}
