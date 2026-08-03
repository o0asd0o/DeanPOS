import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { SidebarContent } from "ui";

import { NAV_GROUPS } from "./helpers.ts";
import { NavGroup } from "./NavGroup.tsx";

// `Settings` is admin-only (issue 07, record 046 §4). Dropping the entry is
// presentation; the route's own refusal is the enforcement.
export function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { orpc } = useRouteContext({ from: "/_shell" });
  const meQuery = useQuery(orpc.auth.me.queryOptions());
  const isAdmin = meQuery.data?.authenticated === true && meQuery.data.role === "admin";

  return (
    <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col">
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <NavGroup
            key={group.label}
            label={group.label}
            items={group.items.filter((item) => isAdmin || item.to !== "/settings")}
            onNavigate={onNavigate}
          />
        ))}
      </SidebarContent>
    </nav>
  );
}
