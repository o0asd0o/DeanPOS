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

import { Route } from "@/routes/prototype-sale.tsx";
import {
  addLine,
  addOptionlessLine,
  composeLine,
  createDraft,
  removeLine,
  updateLine,
  type Draft,
  type DraftLine,
  type DraftLineInput,
} from "@/features/sale/draft-store.ts";
import type { SaleMenuItem } from "@/features/sale/types.ts";
import { prototypeCatalog } from "./fixture.ts";
import { PrototypeModifierModal } from "./PrototypeModifierModal.tsx";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";
import { VariantA } from "./VariantA.tsx";
import { VariantB } from "./VariantB.tsx";
import { VariantC } from "./VariantC.tsx";
import type { ViewMode } from "./variant-props.ts";

// Three variants of the revamped sale screen on ?variant=A|B|C. Throwaway: fixture
// catalog, in-memory draft, no persistence, no transport. Plan: the tablet revamp.
export function SalePrototype() {
  const { variant } = Route.useSearch();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("tile");
  const [drillItem, setDrillItem] = useState<SaleMenuItem | null>(null);
  const [draft, setDraft] = useState<Draft>(() => createDraft());
  const [clearOpen, setClearOpen] = useState(false);
  const [picker, setPicker] = useState<{
    item: SaleMenuItem;
    variantId: string | null;
    lineId?: string;
  } | null>(null);

  // An open search looks at the whole menu; the category is ignored until it closes.
  const items = prototypeCatalog.menuItems.filter((item) =>
    searchOpen && search
      ? item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())
      : categoryId === null || item.categoryId === categoryId,
  );

  const hasOptions = (item: SaleMenuItem) =>
    item.modifierGroups.length > 0 || item.addOns.length > 0;
  const addPlain = (item: SaleMenuItem, variantId: string | null) => {
    const variant = item.variants.find((entry) => entry.id === variantId) ?? null;
    setDraft(
      addOptionlessLine(draft, {
        menuItemId: item.id,
        menuItemName: item.name,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? "",
        unitPriceCentavos: variant?.priceCentavos ?? item.priceCentavos,
      }),
    );
    setDrillItem(null);
  };
  const onVariantSelect = (item: SaleMenuItem, variantId: string) => {
    const variant = item.variants.find((entry) => entry.id === variantId);
    if (!variant?.available) return;
    if (hasOptions(item)) setPicker({ item, variantId });
    else addPlain(item, variantId);
  };
  const onItemSelect = (item: SaleMenuItem) => {
    if (!item.available) return;
    if (item.variants.length > 1) setDrillItem(item);
    else if (item.variants.length === 1) onVariantSelect(item, item.variants[0]!.id);
    else if (hasOptions(item)) setPicker({ item, variantId: null });
    else addPlain(item, null);
  };
  const onEditLine = (line: DraftLine) => {
    const item = prototypeCatalog.menuItems.find((entry) => entry.id === line.menuItemId);
    if (item) setPicker({ item, variantId: line.variantId, lineId: line.id });
  };
  const submitPicker = (input: DraftLineInput) => {
    if (!picker) return;
    const modifiers = picker.item.modifierGroups.flatMap((group) => group.modifiers);
    setDraft(
      picker.lineId
        ? updateLine(draft, picker.lineId, input, modifiers, picker.item.addOns)
        : addLine(draft, composeLine(input, modifiers, picker.item.addOns)),
    );
    setPicker(null);
    setDrillItem(null);
  };

  const props = {
    catalog: prototypeCatalog,
    items,
    draft,
    drillItem,
    categoryId,
    search,
    searchOpen,
    view,
    onCategory: (next: string | null) => {
      setCategoryId(next);
      setDrillItem(null);
    },
    onSearch: setSearch,
    onSearchOpen: setSearchOpen,
    onView: setView,
    onItemSelect,
    onVariantSelect,
    onDrillExit: () => setDrillItem(null),
    onEditLine,
    onClear: () => setClearOpen(true),
  };

  return (
    <>
      {variant === "B" ? (
        <VariantB {...props} />
      ) : variant === "C" ? (
        <VariantC {...props} />
      ) : (
        <VariantA {...props} />
      )}
      {picker && (
        <PrototypeModifierModal
          key={`${picker.lineId ?? "new"}-${picker.variantId ?? "base"}`}
          item={picker.item}
          variant={picker.item.variants.find((entry) => entry.id === picker.variantId) ?? null}
          initial={picker.lineId ? draft.lines.find((line) => line.id === picker.lineId) : undefined}
          onOpenChange={(open) => {
            if (!open) setPicker(null);
          }}
          onSubmit={submitPicker}
          onRemove={
            picker.lineId
              ? () => {
                  setDraft(removeLine(draft, picker.lineId!));
                  setPicker(null);
                }
              : undefined
          }
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
            <Button
              type="button"
              danger
              onClick={() => {
                setDraft(createDraft());
                setClearOpen(false);
              }}
            >
              Clear order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PrototypeSwitcher current={variant} />
    </>
  );
}
