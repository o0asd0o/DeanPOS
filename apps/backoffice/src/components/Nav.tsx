import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { SidebarContent } from "ui";

import { hasAtLeastRole } from "@/lib/roles.ts";

import { NAV_GROUPS } from "./helpers.ts";
import { NavGroup } from "./NavGroup.tsx";

// Settings is admin-only and opens as a dialog, not a sidebar entry
// (record 046 §4). Filtering here is presentation, not enforcement.
export function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { orpc } = useRouteContext({ from: "/_shell" });
  const me = useQuery(orpc.auth.me.queryOptions());
  const role = me.data?.authenticated ? me.data.role : undefined;

  return (
    <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col">
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <NavGroup
            key={group.label}
            label={group.label}
            items={role ? group.items.filter((item) => hasAtLeastRole(role, item.minRole)) : []}
            onNavigate={onNavigate}
          />
        ))}
      </SidebarContent>
    </nav>
  );
}
