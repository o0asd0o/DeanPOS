import { Hint } from "@/components/Hint.tsx";
import type { Store } from "./helpers.ts";

// Native checkboxes in a `<fieldset>`, unstyled (record 054 Q3) — no inline
// switch, so a method never writes an uncorrectable audit row per tap. The
// all-stores box is the same control at the set level, and the warning names
// what an empty set means at the till, which the list then badges No stores.
export function AvailabilityField({
  stores,
  selectedIds,
  onChange,
}: {
  stores: Store[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}) {
  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const selectedCount = stores.filter((store) => selectedIds.has(store.id)).length;
  const allSelected = stores.length > 0 && selectedCount === stores.length;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend>Available at</legend>
      <Hint detail="Unchecking a store stops this method being offered there. Sales already recorded against it stay as they are.">
        Unchecking a store stops this method being offered there.
      </Hint>
      {stores.length === 0 ? (
        <Hint>Add a store first, then you can choose where this method is offered</Hint>
      ) : (
        <>
          {/* Only past one store: with a single store it is the same box twice. */}
          {stores.length > 1 && (
            <label
              htmlFor="payment-method-store-all"
              className="flex cursor-pointer items-center gap-3 px-3 text-sm text-muted-foreground"
            >
              <input
                type="checkbox"
                id="payment-method-store-all"
                className="size-4 accent-primary"
                checked={allSelected}
                ref={(input) => {
                  if (input) input.indeterminate = selectedCount > 0 && !allSelected;
                }}
                onChange={() =>
                  onChange(allSelected ? new Set() : new Set(stores.map((store) => store.id)))
                }
              />
              {allSelected ? "All stores" : `${String(selectedCount)} of ${String(stores.length)}`}
            </label>
          )}
          {stores.map((store) => (
            <label
              key={store.id}
              htmlFor={`payment-method-store-${store.id}`}
              className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 text-sm transition-colors has-[:checked]:border-ring has-[:checked]:bg-accent has-[:focus-visible]:border-ring"
            >
              <input
                type="checkbox"
                id={`payment-method-store-${store.id}`}
                className="size-4 accent-primary"
                checked={selectedIds.has(store.id)}
                onChange={() => toggle(store.id)}
              />
              {store.name}
            </label>
          ))}
          {selectedCount === 0 && (
            <p
              role="status"
              className="rounded-md bg-status-warning-tint p-3 text-sm text-foreground"
            >
              No store selected — this method is saved, but no till offers it.
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
