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

// A — Loyverse faithful: black top bar owns search and the kebab, categories pin
// to the bottom of the grid column, items fill everything between, cart is a
// narrow full-height column with Pay at its foot.
export function VariantA({
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
  const categoryName =
    catalog.categories.find((category) => category.id === categoryId)?.name ?? "All items";
  const optionNames = new Map<string, string>();
  for (const item of catalog.menuItems) {
    for (const group of item.modifierGroups)
      for (const modifier of group.modifiers) optionNames.set(modifier.id, modifier.name);
    for (const addOn of item.addOns) optionNames.set(addOn.id, addOn.name);
  }
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
    <div className="flex h-full min-h-0 flex-col bg-muted/40">
      <div className="flex h-12 shrink-0 items-center gap-2 bg-foreground px-3 text-background">
        {drillItem ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-background hover:bg-background/20 hover:text-background"
            onClick={onDrillExit}
          >
            ‹ {drillItem.name}
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
            onChange={(event) => onSearch(event.target.value)}
          />
        ) : (
          <span className="flex-1 text-sm text-background/70">{tiles.length} items</span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Search menu"
          className="text-xl text-background hover:bg-background/20 hover:text-background"
          onClick={() => {
            if (searchOpen) onSearch("");
            onSearchOpen(!searchOpen);
          }}
        >
          {searchOpen ? "×" : "⌕"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="More actions"
              className="text-xl text-background hover:bg-background/20 hover:text-background"
            >
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

      <div className="flex min-h-0 flex-1 gap-2 p-2">
        <section aria-label="Menu" className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {view === "tile" ? (
              <div className="grid grid-cols-3 gap-2 md:grid-cols-4 2xl:grid-cols-5">
                {tiles.map((tile) => (
                  <Button
                    key={tile.id}
                    type="button"
                    variant="outline"
                    disabled={!tile.available}
                    className="h-20 flex-col items-start justify-between rounded-xl p-3 whitespace-normal"
                    onClick={tile.onSelect}
                  >
                    <span className="line-clamp-2 text-left text-sm leading-tight">{tile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {tile.available ? formatPeso(tile.priceCentavos) : "Sold out"}
                    </span>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col overflow-hidden rounded-xl bg-card">
                {tiles.map((tile) => (
                  <Button
                    key={tile.id}
                    type="button"
                    variant="ghost"
                    disabled={!tile.available}
                    className="h-12 justify-between rounded-none border-b border-border px-4 text-base last:border-b-0"
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

          <div className="flex shrink-0 items-center gap-2">
            <div
              aria-label="Categories"
              role="group"
              className="flex min-w-0 flex-1 gap-2 overflow-x-auto"
            >
              <Button
                type="button"
                variant="outline"
                className="h-12 shrink-0 px-5 text-base"
                aria-pressed={categoryId === null}
                onClick={() => onCategory(null)}
              >
                All
              </Button>
              {catalog.categories.map((category) => (
                <Button
                  key={category.id}
                  type="button"
                  variant="outline"
                  className="h-12 shrink-0 px-5 text-base"
                  aria-pressed={categoryId === category.id}
                  onClick={() => onCategory(category.id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label={view === "tile" ? "Switch to list view" : "Switch to tile view"}
              className="text-xl"
              onClick={() => onView(view === "tile" ? "list" : "tile")}
            >
              {view === "tile" ? "☰" : "▦"}
            </Button>
          </div>
        </section>

        <Card
          aria-label="Current order"
          className="flex h-full w-72 min-h-0 shrink-0 flex-col gap-0 p-3"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Choose a menu item to start.</p>
            ) : (
              lines.map((line) => {
                const modifiers = line.modifierIds
                  .map((id) => optionNames.get(id))
                  .filter((name): name is string => Boolean(name));
                const addOns = [...new Set(line.addOnIds)].map((id) => {
                  const count = line.addOnIds.filter((entry) => entry === id).length;
                  return `${count}× ${optionNames.get(id) ?? id}`;
                });
                return (
                  <Button
                    key={line.id}
                    type="button"
                    variant="ghost"
                    className="h-auto w-full items-start justify-between gap-2 rounded-lg px-2 py-2 whitespace-normal active:scale-98 active:bg-secondary"
                    onClick={() => onEditLine(line)}
                  >
                    <span className="flex min-w-0 gap-2 text-left">
                      <span className="shrink-0 font-semibold tabular-nums">{line.quantity}×</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {line.menuItemName}
                          {line.variantName ? ` · ${line.variantName}` : ""}
                        </span>
                        {modifiers.map((name) => (
                          <span key={name} className="block text-xs text-muted-foreground">
                            {name}
                          </span>
                        ))}
                        {addOns.map((label) => (
                          <span key={label} className="block text-xs text-muted-foreground">
                            + {label}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatPeso(line.totalCentavos)}
                    </span>
                  </Button>
                );
              })
            )}
          </div>
          <div className="flex shrink-0 items-center justify-between px-2 py-3">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">TOTAL</span>
            <span className="text-xl font-semibold tabular-nums">{formatPeso(total)}</span>
          </div>
          <Button type="button" size="lg" className="w-full" disabled={lines.length === 0}>
            Pay {formatPeso(total)}
          </Button>
        </Card>
      </div>
    </div>
  );
}
