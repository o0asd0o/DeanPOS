import type { Draft, DraftLine } from "@/features/sale/draft-store.ts";
import type { SaleCatalog, SaleMenuItem } from "@/features/sale/types.ts";

export type ViewMode = "tile" | "list";

export type VariantProps = {
  catalog: SaleCatalog;
  items: SaleMenuItem[];
  draft: Draft | null;
  drillItem: SaleMenuItem | null;
  categoryId: string | null;
  search: string;
  searchOpen: boolean;
  view: ViewMode;
  onCategory: (categoryId: string | null) => void;
  onSearch: (value: string) => void;
  onSearchOpen: (open: boolean) => void;
  onView: (view: ViewMode) => void;
  onItemSelect: (item: SaleMenuItem) => void;
  onVariantSelect: (item: SaleMenuItem, variantId: string) => void;
  onDrillExit: () => void;
  onEditLine: (line: DraftLine) => void;
  onClear: () => void;
};
