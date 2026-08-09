import { ChevronDownIcon, CheckIcon } from "lucide-react";
import { useState } from "react";
import { Input } from "ui";

type Store = { id: string; name: string };

export function StoreCombobox({
  stores,
  value,
  onValueChange,
}: {
  stores: Store[];
  value: string;
  onValueChange: (storeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const selectedName = stores.find((store) => store.id === value)?.name ?? "";
  const filtered = stores.filter((store) => store.name.toLowerCase().includes(query.toLowerCase()));
  const choose = (store: Store) => {
    onValueChange(store.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-autocomplete="list"
        aria-controls="availability-store-options"
        aria-expanded={open}
        aria-label="Store"
        value={open ? query : selectedName}
        placeholder="Choose a Store"
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(event) => {
          setOpen(true);
          setQuery(event.target.value);
          setHighlighted(0);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 100)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlighted((current) => Math.min(current + 1, filtered.length - 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlighted((current) => Math.max(current - 1, 0));
          }
          if (event.key === "Enter" && filtered[highlighted]) {
            event.preventDefault();
            choose(filtered[highlighted]);
          }
        }}
        className="rounded-full pr-10"
      />
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      {open && (
        <div
          id="availability-store-options"
          role="listbox"
          aria-label="Stores"
          className="absolute top-full z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-popover p-1 text-sm text-popover-foreground shadow-md"
        >
          {filtered.length > 0 ? (
            filtered.map((store, index) => (
              <button
                key={store.id}
                type="button"
                role="option"
                aria-selected={store.id === value}
                className="tap-target flex w-full items-center justify-between rounded-lg px-3 text-left hover:bg-accent aria-selected:bg-accent"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(store)}
              >
                {store.name}
                {index === highlighted && <CheckIcon aria-hidden="true" className="size-4" />}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-muted-foreground">No stores match</p>
          )}
        </div>
      )}
    </div>
  );
}
