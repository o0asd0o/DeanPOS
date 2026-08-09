import {
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "ui";

import { formatPeso } from "./helpers.ts";
import type { VariantProps } from "./variant-props.ts";

// B — the repo's original contract, pushed: categories are a vertical rail on the
// left, items default to dense list rows, cart holds the right. Three columns, no
// bottom chrome at all. Tests whether a rail beats a bottom strip at 1180 wide.
export function VariantB({
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
  const lines = draft?.lines ?? [];
  const total = draft?.totalCentavos ?? 0;
  const rows = drillItem
    ? drillItem.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        priceCentavos: variant.priceCentavos,
        available: variant.available,
        hint: "",
        onSelect: () => onVariantSelect(drillItem, variant.id),
      }))
    : items.map((item) => ({
        id: item.id,
        name: item.name,
        priceCentavos: item.priceCentavos,
        available: item.available,
        hint: item.variants.length > 1 ? `${item.variants.length} variants` : "",
        onSelect: () => onItemSelect(item),
      }));

  return (
    <div className="flex h-full min-h-0 gap-2 p-2">
      <nav
        aria-label="Categories"
        className="flex w-40 shrink-0 flex-col gap-1 overflow-y-auto"
      >
        <Button
          type="button"
          variant="ghost"
          className="h-11 justify-start rounded-lg"
          aria-pressed={categoryId === null}
          onClick={() => onCategory(null)}
        >
          All items
        </Button>
        {catalog.categories.map((category) => (
          <Button
            key={category.id}
            type="button"
            variant="ghost"
            className="h-11 justify-start rounded-lg text-left whitespace-normal"
            aria-pressed={categoryId === category.id}
            onClick={() => onCategory(category.id)}
          >
            {category.name}
          </Button>
        ))}
      </nav>

      <section aria-label="Menu" className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 items-center gap-2">
          {drillItem ? (
            <Button type="button" variant="outline" size="sm" onClick={onDrillExit}>
              ‹ {drillItem.name}
            </Button>
          ) : searchOpen ? (
            <Input
              autoFocus
              aria-label="Search menu"
              placeholder="Search the whole menu…"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          ) : (
            <span className="flex-1 text-sm text-muted-foreground">{rows.length} items</span>
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === "list" ? (
            <div className="flex flex-col">
              {rows.map((row) => (
                <Button
                  key={row.id}
                  type="button"
                  variant="ghost"
                  disabled={!row.available}
                  className="h-11 justify-between rounded-none px-3"
                  onClick={row.onSelect}
                >
                  <span className="truncate">{row.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {!row.available ? "Sold out" : row.hint || formatPeso(row.priceCentavos)}
                  </span>
                </Button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 xl:grid-cols-4 2xl:grid-cols-5">
              {rows.map((row) => (
                <Button
                  key={row.id}
                  type="button"
                  variant="outline"
                  disabled={!row.available}
                  className="h-20 flex-col items-start justify-between rounded-xl p-3 whitespace-normal"
                  onClick={row.onSelect}
                >
                  <span className="line-clamp-2 text-left text-sm leading-tight">{row.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {!row.available ? "Sold out" : row.hint || formatPeso(row.priceCentavos)}
                  </span>
                </Button>
              ))}
            </div>
          )}
        </div>
      </section>

      <Card aria-label="Current order" className="flex h-full w-80 min-h-0 shrink-0 flex-col gap-0 p-3">
        <div className="flex shrink-0 items-center justify-between pb-2">
          <span className="font-semibold">Ticket</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="More actions">
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
        <div className="min-h-0 flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Choose a menu item to start.</p>
          ) : (
            lines.map((line) => (
              <Button
                key={line.id}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-between rounded-lg px-2 py-2 whitespace-normal"
                onClick={() => onEditLine(line)}
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
        <div className="flex shrink-0 items-center justify-between px-2 py-3">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-semibold">{formatPeso(total)}</span>
        </div>
        <Button type="button" size="lg" className="w-full" disabled={lines.length === 0}>
          Charge {formatPeso(total)}
        </Button>
      </Card>
    </div>
  );
}
