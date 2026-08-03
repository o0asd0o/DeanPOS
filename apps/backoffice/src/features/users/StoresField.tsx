type Store = { id: string; name: string };

// Native checkboxes in a `<fieldset>`, one per visible Store (record 045 §1
// clause 3): `packages/ui` has no `Checkbox`, and SC 2.5.7 (record 039)
// rules out a drag- or transfer-based control before it is compared. Left
// unstyled — the UA rendering is the control, and the global focus
// indicator (records 007/014) is its focus ring, unrestyled.
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
      <p className="text-foreground">
        Unchecking a store closes that assignment. It stays on the record, so past sales at that
        store remain attributed to this person.
      </p>
      {stores.length === 0 ? (
        <p className="text-foreground">Add a store first, then you can assign this person to it</p>
      ) : (
        stores.map((store) => (
          <div key={store.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`store-${store.id}`}
              checked={selectedIds.has(store.id)}
              onChange={() => toggle(store.id)}
            />
            <label htmlFor={`store-${store.id}`}>{store.name}</label>
          </div>
        ))
      )}
    </fieldset>
  );
}
