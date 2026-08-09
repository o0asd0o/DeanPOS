import { useState } from "react";
import { Badge, Button } from "ui";
import {
  useAllAddOnsQuery,
  useLinkAddOnToItemMutation,
  useLinkedAddOnsForItemQuery,
  useUnlinkAddOnFromItemMutation,
} from "./__common/queries.ts";

export function AddOnPicker({ menuItemId }: { menuItemId: string }) {
  const allAddOns = useAllAddOnsQuery();
  const linkedAddOns = useLinkedAddOnsForItemQuery(menuItemId);
  const link = useLinkAddOnToItemMutation(menuItemId);
  const unlink = useUnlinkAddOnFromItemMutation(menuItemId);
  const [announcement, setAnnouncement] = useState("");
  const available = (allAddOns.data ?? []).filter((addOn) => !addOn.archivedAt);
  const linked = new Set((linkedAddOns.data ?? []).map((addOn) => addOn.id));
  if (available.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <ul className="flex flex-col gap-1" aria-label="Add-ons">
        {available.map((addOn) => {
          const isLinked = linked.has(addOn.id);
          const busy = link.isPending || unlink.isPending;
          return (
            <li
              key={addOn.id}
              className="flex items-center justify-between gap-2 rounded-md border p-2"
            >
              <span className="text-sm">{addOn.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {addOn.maximum ?? "Unlimited"}
                </Badge>
                <Button
                  type="button"
                  variant={isLinked ? "outline" : "ghost"}
                  size="sm"
                  disabled={busy}
                  aria-pressed={isLinked}
                  aria-label={isLinked ? `Unlink ${addOn.name}` : `Link ${addOn.name}`}
                  onClick={() => {
                    if (isLinked)
                      unlink.mutate(
                        { menuItemId, addOnId: addOn.id },
                        { onSuccess: () => setAnnouncement(`Unlinked ${addOn.name}`) },
                      );
                    else
                      link.mutate(
                        { menuItemId, addOnId: addOn.id },
                        {
                          onSuccess: (result) =>
                            setAnnouncement(
                              result
                                ? `Linked ${addOn.name}`
                                : `Couldn't link ${addOn.name} — price would go negative`,
                            ),
                        },
                      );
                  }}
                >
                  {isLinked ? "Linked" : "Link"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
