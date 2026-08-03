import { SidebarContent } from "ui";

import { NAV_GROUPS } from "./helpers.ts";
import { NavGroup } from "./NavGroup.tsx";

// Three named groups, not the mock's two — record 022. Every entry routes to a
// `Placeholder`; the screens themselves belong to later areas. Record 020.
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
