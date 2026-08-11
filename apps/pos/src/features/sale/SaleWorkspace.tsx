import { useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeftIcon, SearchIcon, XIcon } from "lucide-react";
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
import { PaymentFlow } from "@/features/payment/PaymentFlow.tsx";
import { ReceiptView } from "@/features/receipt/ReceiptView.tsx";
import type { Receipt } from "contract/src/contract.ts";
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
import { CartFlightLayer, type CartFlight } from "./CartFlightLayer.tsx";

type Props = { catalog: SaleCatalog };

function createOptionNames(menuItems: readonly SaleMenuItem[]) {
  const optionNames = new Map<string, string>();

  for (const item of menuItems) {
    for (const modifier of item.modifierGroups.flatMap((group) => group.modifiers)) {
      optionNames.set(modifier.id, modifier.name);
    }
    for (const addOn of item.addOns) {
      optionNames.set(addOn.id, addOn.name);
    }
  }

  return optionNames;
}

export function SaleWorkspace({ catalog }: Props) {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SaleMenuItem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(() => readDraft());
  const [clearOpen, setClearOpen] = useState(false);
  const [workspace, setWorkspace] = useState<"sale" | "payment" | "receipt">("sale");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [picker, setPicker] = useState<{
    item: SaleMenuItem;
    variantId: string | null;
    lineId?: string;
  } | null>(null);
  const [flights, setFlights] = useState<CartFlight[]>([]);

  const visibleItems = catalog.menuItems.filter(
    (item) =>
      (search !== "" || categoryId === null || item.categoryId === categoryId) &&
      item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const categoryName =
    catalog.categories.find((category) => category.id === categoryId)?.name ?? "All items";
  const tileCount = selectedItem ? selectedItem.variants.length : visibleItems.length;
  const optionNames = useMemo(() => createOptionNames(catalog.menuItems), [catalog.menuItems]);
  const ensureDraft = () => {
    if (draft) return draft;
    const next = createDraft();
    writeDraft(next);
    setDraft(next);
    return next;
  };
  const beginFlight = (source: HTMLElement, label: string) => {
    const target = window.matchMedia?.("(min-width: 768px)").matches
      ? document.querySelector<HTMLElement>('[data-cart-target="desktop"]')
      : document.querySelector<HTMLElement>('[data-cart-target="mobile"]');
    if (!target) return;
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    const targetX = targetRect.left + targetRect.width / 2;
    const targetY = targetRect.top + targetRect.height / 2;
    setFlights((current) => [
      ...current.slice(-3),
      {
        id: crypto.randomUUID(),
        label,
        sourceX,
        sourceY,
        deltaX: targetX - sourceX,
        deltaY: targetY - sourceY,
      },
    ]);
  };
  const addVariant = (item: SaleMenuItem, variantId: string, source?: HTMLElement) => {
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
    if (source) beginFlight(source, item.name);
  };
  const submitPicker = (input: Parameters<typeof composeLine>[0], source: HTMLElement) => {
    if (!picker) return;
    const isNewLine = !picker.lineId;
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
    if (isNewLine) beginFlight(source, picker.item.name);
  };
  const editLine = (line: Draft["lines"][number]) => {
    const item = catalog.menuItems.find((entry) => entry.id === line.menuItemId);
    if (item) setPicker({ item, variantId: line.variantId, lineId: line.id });
  };
  const addBaseItem = (item: SaleMenuItem, source?: HTMLElement) => {
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
    if (source) beginFlight(source, item.name);
  };
  const selectItem = (item: SaleMenuItem, source: HTMLElement) => {
    if (!item.available) return;
    ensureDraft();
    if (item.variants.length === 0) addBaseItem(item, source);
    else if (item.variants.length === 1) addVariant(item, item.variants[0]!.id, source);
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
  const header =
    workspace === "payment" ? (
      <>
        <span className="shrink-0 font-semibold">Payment</span>
        <span className="flex-1 text-sm text-background/70">Cash</span>
      </>
    ) : workspace === "receipt" ? (
      <span className="shrink-0 font-semibold">Receipt</span>
    ) : (
      <>
        {selectedItem ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-background hover:bg-background/20 hover:text-background"
            onClick={() => setSelectedItem(null)}
          >
            <ChevronLeftIcon className="mr-1 size-4 shrink-0" />
            <span>{selectedItem.name}</span>
          </Button>
        ) : (
          <span className="shrink-0 font-semibold whitespace-nowrap">{categoryName}</span>
        )}
        {searchOpen ? (
          <Input
            autoFocus
            aria-label="Search menu"
            placeholder="Search the whole menu…"
            className="h-9 bg-background text-foreground"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        ) : (
          <span className="flex-1 text-sm text-background/70">{tileCount} items</span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Search menu"
          className="text-background hover:bg-background/20 hover:text-background"
          onClick={() => {
            setSearchOpen((current) => !current);
            if (searchOpen) setSearch("");
          }}
        >
          {searchOpen ? <XIcon aria-hidden="true" /> : <SearchIcon aria-hidden="true" />}
        </Button>
        <SaleKebabMenu disabled={(draft?.lines.length ?? 0) === 0} onClear={requestClear} />
      </>
    );
  const headerTarget = document.getElementById("shell-sale-header");
  useLayoutEffect(() => {
    const defaultHeader = document.getElementById("shell-default-header");
    if (!headerTarget) return;
    defaultHeader?.setAttribute("hidden", "");
    headerTarget.removeAttribute("hidden");
    return () => {
      defaultHeader?.removeAttribute("hidden");
      headerTarget.setAttribute("hidden", "");
    };
  }, [headerTarget]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background p-2 md:p-3">
      {headerTarget ? (
        createPortal(header, headerTarget)
      ) : (
        <div className="mb-2 flex h-12 shrink-0 items-center gap-2 rounded-xl bg-foreground px-3 text-background">
          {header}
        </div>
      )}
      {workspace === "receipt" && receipt ? (
        <ReceiptView
          receipt={receipt}
          onNewOrder={() => {
            setReceipt(null);
            setWorkspace("sale");
          }}
        />
      ) : workspace === "payment" && draft ? (
        <PaymentFlow
          draft={draft}
          catalog={catalog}
          onBack={() => setWorkspace("sale")}
          onDraftChanged={setDraft}
          onCompleted={(completedReceipt) => {
            setReceipt(completedReceipt);
            setDraft(null);
            setWorkspace("receipt");
          }}
        />
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 pb-20 md:gap-3 md:pb-0">
          {selectedItem ? (
            <VariantGrid
              item={selectedItem}
              categories={catalog.categories}
              selectedCategoryId={categoryId}
              viewMode={viewMode}
              onCategorySelect={selectCategory}
              onViewModeChange={setSavedViewMode}
              onVariantSelect={(variantId, source) => addVariant(selectedItem, variantId, source)}
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
            <Cart
              ariaLabel="Current order"
              draft={draft}
              optionNames={optionNames}
              onEdit={editLine}
              onPay={() => setWorkspace("payment")}
            />
          </div>
        </div>
      )}
      {workspace === "sale" && (
        <MobileCart
          draft={draft}
          optionNames={optionNames}
          onEdit={editLine}
          onPay={() => setWorkspace("payment")}
        />
      )}
      <CartFlightLayer
        flights={flights}
        onComplete={(id) => setFlights((current) => current.filter((flight) => flight.id !== id))}
      />
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
