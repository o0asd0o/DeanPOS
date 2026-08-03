import { SidebarContent } from "ui";

import { NAV_GROUPS } from "./helpers.ts";
import { NavGroup } from "./NavGroup.tsx";

// Settings is not here: admin-only (record 046 §4), it opens as a dialog from
// the account menu, so the sidebar carries no entry for it at all.
export function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col">
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <NavGroup
            key={group.label}
            label={group.label}
            items={group.items}
            onNavigate={onNavigate}
          />
        ))}
      </SidebarContent>
    </nav>
  );
}
