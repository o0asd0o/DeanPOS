import { useState } from "react";
import { Badge, Button } from "ui";

import {
  useAllModifierGroupsQuery,
  useLinkModifierGroupMutation,
  useLinkedModifierGroupsQuery,
  useUnlinkModifierGroupMutation,
} from "./__common/queries.ts";

export function ModifierGroupPicker({ variantId }: { variantId: string }) {
  const allGroupsQuery = useAllModifierGroupsQuery();
  const linkedQuery = useLinkedModifierGroupsQuery(variantId);
  const link = useLinkModifierGroupMutation(variantId);
  const unlink = useUnlinkModifierGroupMutation(variantId);
  const [announcement, setAnnouncement] = useState<{ text: string; slot: 0 | 1 }>({
    text: "",
    slot: 0,
  });

  const announce = (text: string) =>
    setAnnouncement((prev) => ({ text, slot: prev.slot === 0 ? 1 : 0 }));

  const available = (allGroupsQuery.data ?? []).filter((g) => !g.archivedAt);
  const linkedIds = new Set((linkedQuery.data ?? []).map((g) => g.id));

  if (available.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Modifier groups</p>
      <p role="status" className="sr-only">
        {announcement.slot === 0 ? announcement.text : ""}
      </p>
      <p role="status" className="sr-only">
        {announcement.slot === 1 ? announcement.text : ""}
      </p>
      <ul className="flex flex-col gap-1" aria-label="Modifier groups">
        {available.map((group) => {
          const linked = linkedIds.has(group.id);
          const busy = link.isPending || unlink.isPending;
          return (
            <li
              key={group.id}
              className="flex items-center justify-between gap-2 rounded-md border p-2"
            >
              <span className="text-sm">{group.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {group.selectionRule}
                </Badge>
                <Button
                  type="button"
                  variant={linked ? "outline" : "ghost"}
                  size="sm"
                  disabled={busy}
                  aria-pressed={linked}
                  aria-label={linked ? `Unlink ${group.name}` : `Link ${group.name}`}
                  onClick={() => {
                    if (linked) {
                      unlink.mutate(
                        { variantId, modifierGroupId: group.id },
                        { onSuccess: () => announce(`Unlinked ${group.name}`) },
                      );
                    } else {
                      link.mutate(
                        { variantId, modifierGroupId: group.id },
                        {
                          onSuccess: (result) =>
                            announce(
                              result
                                ? `Linked ${group.name}`
                                : `Couldn't link ${group.name} — price would go negative`,
                            ),
                        },
                      );
                    }
                  }}
                >
                  {linked ? "Linked" : "Link"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
