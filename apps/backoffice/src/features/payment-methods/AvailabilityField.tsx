import { Hint } from "@/components/Hint.tsx";

type Store = { id: string; name: string };

// Native checkboxes in a `<fieldset>`, unstyled (record 054 Q3) — no inline
// switch, so a method never writes an uncorrectable audit row per tap.
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

  return (
    <fieldset className="flex flex-col gap-2">
      <legend>Available at</legend>
      <Hint detail="Unchecking a store stops this method being offered there. Sales already recorded against it stay as they are.">
        Unchecking a store stops this method being offered there.
      </Hint>
      {stores.length === 0 ? (
        <Hint>Add a store first, then you can choose where this method is offered</Hint>
      ) : (
        stores.map((store) => (
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
        ))
      )}
    </fieldset>
  );
}
