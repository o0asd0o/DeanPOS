import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui";

import { Cart } from "./Cart.tsx";
import {
  addOptionlessLine,
  clearDraft,
  createDraft,
  readDraft,
  writeDraft,
  type Draft,
} from "./draft-store.ts";
import { MobileCart } from "./MobileCart.tsx";
import { SaleGrid } from "./SaleGrid.tsx";
import type { SaleCatalog, SaleMenuItem } from "./types.ts";
import { VariantGrid } from "./VariantGrid.tsx";

type Props = { catalog: SaleCatalog };

export function SaleWorkspace({ catalog }: Props) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SaleMenuItem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(() => readDraft());
  const [clearOpen, setClearOpen] = useState(false);

  const visibleItems = catalog.menuItems.filter(
    (item) =>
      (categoryId === null || item.categoryId === categoryId) &&
      item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const ensureDraft = () => {
    if (draft) return draft;
    const next = createDraft();
    writeDraft(next);
    setDraft(next);
    return next;
  };
  const addVariant = (item: SaleMenuItem, variantId: string) => {
    const variant = item.variants.find((entry) => entry.id === variantId);
    if (
      !variant ||
      !variant.available ||
      item.modifierGroups.length > 0 ||
      item.addOns.length > 0
    )
      return;
    const next = addOptionlessLine(ensureDraft(), {
      menuItemId: item.id,
      menuItemName: item.name,
      variantId: variant.id,
      variantName: variant.name,
      unitPriceCentavos: variant.priceCentavos,
    });
    writeDraft(next);
    setDraft(next);
    setSelectedItem(null);
  };
  const selectItem = (item: SaleMenuItem) => {
    if (!item.available) return;
    ensureDraft();
    if (item.variants.length === 1) addVariant(item, item.variants[0]!.id);
    else setSelectedItem(item);
  };
  const requestClear = () => {
    if ((draft?.lines.length ?? 0) === 0) return;
    setClearOpen(true);
  };
  const confirmClear = () => {
    clearDraft();
    setDraft(null);
    setClearOpen(false);
  };
  const selectCategory = (nextCategoryId: string | null) => {
    setCategoryId(nextCategoryId);
    setSelectedItem(null);
  };

  return (
    <div className="flex min-h-0 flex-1 bg-muted/40 md:p-4 pt-0!">
      <div className="flex min-w-0 flex-1 md:gap-4">
        {selectedItem ? (
          <VariantGrid
            item={selectedItem}
            categories={catalog.categories}
            onBack={() => setSelectedItem(null)}
            onCategorySelect={selectCategory}
            onVariantSelect={(variantId) => addVariant(selectedItem, variantId)}
          />
        ) : (
          <SaleGrid
            categories={catalog.categories}
            items={visibleItems}
            search={search}
            selectedCategoryId={categoryId}
            onSearchChange={setSearch}
            onCategorySelect={selectCategory}
            onItemSelect={selectItem}
          />
        )}
        <div className="hidden min-h-0 self-start md:flex">
          <Cart draft={draft} onClear={requestClear} />
        </div>
      </div>
      <MobileCart draft={draft} onClear={requestClear} />
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear this order?</DialogTitle>
            <DialogDescription>
              All lines in this draft will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" danger onClick={confirmClear}>
              Clear order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
