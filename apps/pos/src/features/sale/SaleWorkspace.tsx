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
  addLine,
  clearDraft,
  composeLine,
  createDraft,
  removeLine,
  readDraft,
  updateLine,
  writeDraft,
  type Draft,
} from "./draft-store.ts";
import { MobileCart } from "./MobileCart.tsx";
import { ModifierAddonModal } from "./ModifierAddonModal.tsx";
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
  const [picker, setPicker] = useState<{
    item: SaleMenuItem;
    variantId: string;
    lineId?: string;
  } | null>(null);

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
    if (!variant || !variant.available) return;
    if (item.modifierGroups.length > 0 || item.addOns.length > 0) {
      setPicker({ item, variantId: variant.id });
      return;
    }
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
  const submitPicker = (input: Parameters<typeof composeLine>[0]) => {
    if (!picker) return;
    const next = picker.lineId
      ? updateLine(
          ensureDraft(),
          picker.lineId,
          input,
          picker.item.modifierGroups.flatMap((g) => g.modifiers),
          picker.item.addOns,
        )
      : addLine(
          ensureDraft(),
          composeLine(
            input,
            picker.item.modifierGroups.flatMap((g) => g.modifiers),
            picker.item.addOns,
          ),
        );
    writeDraft(next);
    setDraft(next);
    setPicker(null);
    setSelectedItem(null);
  };
  const editLine = (line: Draft["lines"][number]) => {
    const item = catalog.menuItems.find((entry) => entry.id === line.menuItemId);
    const variant = item?.variants.find((entry) => entry.id === line.variantId);
    if (item && variant) setPicker({ item, variantId: variant.id, lineId: line.id });
  };
  const changeQuantity = (lineId: string, quantity: number) => {
    const line = draft?.lines.find((entry) => entry.id === lineId);
    if (!draft || !line) return;
    const item = catalog.menuItems.find((entry) => entry.id === line.menuItemId);
    if (!item) return;
    const next = updateLine(
      draft,
      lineId,
      { ...line, quantity },
      item.modifierGroups.flatMap((g) => g.modifiers),
      item.addOns,
    );
    writeDraft(next);
    setDraft(next);
  };
  const addBaseItem = (item: SaleMenuItem) => {
    if (item.modifierGroups.length > 0 || item.addOns.length > 0) return;
    const next = addOptionlessLine(ensureDraft(), {
      menuItemId: item.id,
      menuItemName: item.name,
      variantId: null,
      variantName: "",
      unitPriceCentavos: item.priceCentavos,
    });
    writeDraft(next);
    setDraft(next);
  };
  const selectItem = (item: SaleMenuItem) => {
    if (!item.available) return;
    ensureDraft();
    if (item.variants.length === 0) addBaseItem(item);
    else if (item.variants.length === 1) addVariant(item, item.variants[0]!.id);
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
          <Cart
            draft={draft}
            onClear={requestClear}
            onEdit={editLine}
            onQuantityChange={changeQuantity}
            onRemove={(lineId) => {
              const next = draft ? removeLine(draft, lineId) : null;
              if (next) {
                writeDraft(next);
                setDraft(next);
              }
            }}
          />
        </div>
      </div>
      <MobileCart
        draft={draft}
        onClear={requestClear}
        onEdit={editLine}
        onQuantityChange={changeQuantity}
        onRemove={(lineId) => {
          const next = draft ? removeLine(draft, lineId) : null;
          if (next) {
            writeDraft(next);
            setDraft(next);
          }
        }}
      />
      {picker && (
        <ModifierAddonModal
          key={`${picker.lineId ?? "new"}-${picker.variantId}`}
          item={picker.item}
          variant={picker.item.variants.find((entry) => entry.id === picker.variantId)!}
          open
          onOpenChange={(open) => {
            if (!open) setPicker(null);
          }}
          initial={
            picker.lineId ? draft?.lines.find((line) => line.id === picker.lineId) : undefined
          }
          onSubmit={submitPicker}
        />
      )}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear this order?</DialogTitle>
            <DialogDescription>All lines in this draft will be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClearOpen(false)}>
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
