import { Hint } from "@/components/Hint.tsx";
type Store = { id: string; name: string };

// Native checkboxes in a `<fieldset>`, unstyled (record 045 §1 clause 3,
// record 039).
export function StoresField({
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
      <legend>Stores</legend>
      <Hint detail="Unchecking a store closes that assignment. It stays on the record, so past sales at that store remain attributed to this person.">
        Unchecking closes an assignment.
      </Hint>
      {stores.length === 0 ? (
        <Hint>Add a store first, then you can assign this person to it</Hint>
      ) : (
        stores.map((store) => (
          // The whole card is the hit area; the input stays real so the label
          // association, keyboard behaviour and `getByLabelText` all hold.
          <label
            key={store.id}
            htmlFor={`store-${store.id}`}
            className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 text-sm transition-colors has-[:checked]:border-ring has-[:checked]:bg-accent has-[:focus-visible]:border-ring"
          >
            <input
              type="checkbox"
              id={`store-${store.id}`}
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
