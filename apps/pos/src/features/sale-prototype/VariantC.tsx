import { useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "ui";

import { formatPeso } from "./helpers.ts";
import type { VariantProps } from "./variant-props.ts";

// C — goal #1 taken to its limit: no cart column and no category strip. Items own
// the whole screen; the category picker is a header dropdown and the ticket lives
// in a bottom action bar that opens a sheet. Tests whether a persistent cart earns
// its 384px at 1180 wide.
export function VariantC({
  catalog,
  items,
  draft,
  drillItem,
  categoryId,
  search,
  searchOpen,
  view,
  onCategory,
  onSearch,
  onSearchOpen,
  onView,
  onItemSelect,
  onVariantSelect,
  onDrillExit,
  onEditLine,
  onClear,
}: VariantProps) {
  const [ticketOpen, setTicketOpen] = useState(false);
  const lines = draft?.lines ?? [];
  const total = draft?.totalCentavos ?? 0;
  const categoryName =
    catalog.categories.find((category) => category.id === categoryId)?.name ?? "All items";
  const tiles = drillItem
    ? drillItem.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        priceCentavos: variant.priceCentavos,
        available: variant.available,
        onSelect: () => onVariantSelect(drillItem, variant.id),
      }))
    : items.map((item) => ({
        id: item.id,
        name: item.name,
        priceCentavos: item.priceCentavos,
        available: item.available,
        onSelect: () => onItemSelect(item),
      }));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <div className="flex shrink-0 items-center gap-2">
        {drillItem ? (
          <Button type="button" variant="outline" size="sm" onClick={onDrillExit}>
            ‹ {drillItem.name}
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                {categoryName} ▾
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => onCategory(null)}>All items</DropdownMenuItem>
              {catalog.categories.map((category) => (
                <DropdownMenuItem key={category.id} onSelect={() => onCategory(category.id)}>
                  {category.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {searchOpen ? (
          <Input
            autoFocus
            aria-label="Search menu"
            placeholder="Search the whole menu…"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        ) : (
          <span className="flex-1 text-sm text-muted-foreground">{tiles.length} items</span>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Search menu"
          onClick={() => {
            if (searchOpen) onSearch("");
            onSearchOpen(!searchOpen);
          }}
        >
          {searchOpen ? "×" : "⌕"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={view === "tile" ? "Switch to list view" : "Switch to tile view"}
          onClick={() => onView(view === "tile" ? "list" : "tile")}
        >
          {view === "tile" ? "☰" : "▦"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon-sm" aria-label="More actions">
              ⋮
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Lock terminal</DropdownMenuItem>
            <DropdownMenuItem disabled={lines.length === 0} onSelect={onClear}>
              Clear order
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div aria-label="Menu" className="min-h-0 flex-1 overflow-y-auto">
        {view === "tile" ? (
          <div className="grid grid-cols-4 gap-2 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
            {tiles.map((tile) => (
              <Button
                key={tile.id}
                type="button"
                variant="outline"
                disabled={!tile.available}
                className="h-20 flex-col items-start justify-between rounded-xl p-2 whitespace-normal"
                onClick={tile.onSelect}
              >
                <span className="line-clamp-2 text-left text-xs leading-tight">{tile.name}</span>
                <span className="text-xs text-muted-foreground">
                  {tile.available ? formatPeso(tile.priceCentavos) : "Sold out"}
                </span>
              </Button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4">
            {tiles.map((tile) => (
              <Button
                key={tile.id}
                type="button"
                variant="ghost"
                disabled={!tile.available}
                className="h-11 justify-between rounded-none px-3"
                onClick={tile.onSelect}
              >
                <span className="truncate">{tile.name}</span>
                <span className="text-sm text-muted-foreground">
                  {tile.available ? formatPeso(tile.priceCentavos) : "Sold out"}
                </span>
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-secondary p-2">
        <Sheet open={ticketOpen} onOpenChange={setTicketOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" className="h-12 flex-1 justify-between px-3">
              <span>
                {lines.length} items · {formatPeso(total)}
              </span>
              <span className="text-muted-foreground">Open ticket ▲</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex flex-col">
            <SheetHeader>
              <SheetTitle>Ticket</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              {lines.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">Nothing on this ticket yet.</p>
              ) : (
                lines.map((line) => (
                  <Button
                    key={line.id}
                    type="button"
                    variant="ghost"
                    className="h-auto w-full justify-between rounded-lg px-2 py-3 whitespace-normal"
                    onClick={() => {
                      setTicketOpen(false);
                      onEditLine(line);
                    }}
                  >
                    <span className="min-w-0 truncate text-left">
                      {line.menuItemName}
                      {line.variantName ? ` · ${line.variantName}` : ""}
                      <span className="text-muted-foreground"> × {line.quantity}</span>
                    </span>
                    <span className="shrink-0 font-medium">{formatPeso(line.totalCentavos)}</span>
                  </Button>
                ))
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-3">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-semibold">{formatPeso(total)}</span>
            </div>
          </SheetContent>
        </Sheet>
        <Button type="button" size="lg" disabled={lines.length === 0}>
          Pay {formatPeso(total)}
        </Button>
      </div>
    </div>
  );
}
