import { LayoutGrid, List } from "lucide-react";
import { Button } from "ui";

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
    <div className="flex shrink-0 items-center gap-2 bg-muted/70 p-2 md:p-3">
      <CategoryTabs
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={onCategorySelect}
      />
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="bg-card shadow-none"
        aria-label={nextViewMode === "list" ? "List view" : "Tile view"}
        onClick={() => onViewModeChange(nextViewMode)}
      >
        {nextViewMode === "list" ? <List aria-hidden="true" /> : <LayoutGrid aria-hidden="true" />}
      </Button>
    </div>
  );
}
