import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
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
import { SaleKebabMenu } from "./SaleKebabMenu.tsx";
import { SaleGrid } from "./SaleGrid.tsx";
import type { SaleCatalog, SaleMenuItem } from "./types.ts";
import { VariantGrid } from "./VariantGrid.tsx";
import { readViewMode, writeViewMode, type ViewMode } from "./view-mode.ts";

type Props = { catalog: SaleCatalog };

export function SaleWorkspace({ catalog }: Props) {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SaleMenuItem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(() => readDraft());
  const [clearOpen, setClearOpen] = useState(false);
  const [picker, setPicker] = useState<{
    item: SaleMenuItem;
    variantId: string | null;
    lineId?: string;
  } | null>(null);

  const visibleItems = catalog.menuItems.filter(
    (item) =>
      (search !== "" || categoryId === null || item.categoryId === categoryId) &&
      item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const optionNames = new Map<string, string>();
  for (const item of catalog.menuItems) {
    for (const group of item.modifierGroups)
      for (const modifier of group.modifiers) optionNames.set(modifier.id, modifier.name);
    for (const addOn of item.addOns) optionNames.set(addOn.id, addOn.name);
  }
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
    if (item) setPicker({ item, variantId: line.variantId, lineId: line.id });
  };
  const addBaseItem = (item: SaleMenuItem) => {
    if (item.modifierGroups.length > 0 || item.addOns.length > 0) {
      setPicker({ item, variantId: null });
      return;
    }
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
  const setSavedViewMode = (nextViewMode: ViewMode) => {
    writeViewMode(nextViewMode);
    setViewMode(nextViewMode);
  };
  const headerActions = (
    <span data-sale-actions className="flex min-w-0 flex-1 items-center justify-end gap-1">
      {selectedItem && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-background hover:bg-background/20 hover:text-background"
          onClick={() => setSelectedItem(null)}
        >
          ‹ {selectedItem.name}
        </Button>
      )}
      {searchOpen && (
        <Input
          autoFocus
          aria-label="Search menu"
          placeholder="Search menu…"
          className="h-9 min-w-0 flex-1 bg-background text-foreground"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Search menu"
        onClick={() => {
          setSearchOpen((current) => !current);
          if (searchOpen) setSearch("");
        }}
      >
        {searchOpen ? "×" : "⌕"}
      </Button>
      <SaleKebabMenu disabled={(draft?.lines.length ?? 0) === 0} onClear={requestClear} />
    </span>
  );
  const headerTarget = document.getElementById("shell-header-actions");
  useEffect(() => {
    const lockAction = document.getElementById("shell-lock-action");
    lockAction?.classList.add("hidden");
    return () => lockAction?.classList.remove("hidden");
  }, []);
  useEffect(() => {
    const context = document.getElementById("shell-header-context");
    const actionArea = document.getElementById("shell-header-action-area");
    context?.classList.toggle("hidden", searchOpen);
    actionArea?.classList.toggle("flex-1", searchOpen);
    actionArea?.classList.toggle("ml-auto", !searchOpen);
    return () => {
      context?.classList.remove("hidden");
      actionArea?.classList.remove("flex-1");
      actionArea?.classList.add("ml-auto");
    };
  }, [searchOpen]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-muted/40 md:p-4">
      {headerTarget ? (
        createPortal(headerActions, headerTarget)
      ) : (
        <div className="flex justify-end gap-1">{headerActions}</div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 md:gap-4">
        {selectedItem ? (
          <VariantGrid
            item={selectedItem}
            categories={catalog.categories}
            viewMode={viewMode}
            onCategorySelect={selectCategory}
            onViewModeChange={setSavedViewMode}
            onVariantSelect={(variantId) => addVariant(selectedItem, variantId)}
          />
        ) : (
          <SaleGrid
            categories={catalog.categories}
            items={visibleItems}
            selectedCategoryId={categoryId}
            viewMode={viewMode}
            onViewModeChange={setSavedViewMode}
            onCategorySelect={selectCategory}
            onItemSelect={selectItem}
          />
        )}
        <div className="hidden min-h-0 md:flex">
          <Cart draft={draft} optionNames={optionNames} onEdit={editLine} />
        </div>
      </div>
      <MobileCart draft={draft} optionNames={optionNames} onEdit={editLine} />
      {picker && (
        <ModifierAddonModal
          key={`${picker.lineId ?? "new"}-${picker.variantId}`}
          item={picker.item}
          variant={picker.item.variants.find((entry) => entry.id === picker.variantId) ?? null}
          open
          onOpenChange={(open) => {
            if (!open) setPicker(null);
          }}
          initial={
            picker.lineId ? draft?.lines.find((line) => line.id === picker.lineId) : undefined
          }
          onSubmit={submitPicker}
          onRemove={() => {
            if (!picker.lineId || !draft) return;
            const next = removeLine(draft, picker.lineId);
            writeDraft(next);
            setDraft(next);
            setPicker(null);
          }}
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
