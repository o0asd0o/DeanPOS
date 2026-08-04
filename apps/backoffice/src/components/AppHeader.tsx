import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

import { GlobalSearch } from "./GlobalSearch.tsx";
import { NotificationsMenu } from "./NotificationsMenu.tsx";
import { UserMenu } from "./UserMenu.tsx";

// The reference's content-column bar (`.scratch/decisions/048`): greeting and
// search left, notifications and the account menu right. A `<div>`, not a
// `<header>` — record 021 keeps the page's one banner in the sidebar.
export function AppHeader() {
  const { orpc } = useRouteContext({ from: "/_shell" });
  const me = useQuery(orpc.auth.me.queryOptions());
  const firstName = me.data?.authenticated ? me.data.firstName : undefined;

  return (
    <div className="relative mx-4 flex min-h-20 items-center gap-3 border-b py-4">
      <p className="hidden text-lg font-medium whitespace-nowrap sm:block">
        👋 Hi {firstName || "there"}
      </p>
      {/* Out of the flow: the search sits on the screen's centre line, which is
          left of this column's own (`screen-centered`). */}
      <div className="screen-centered w-72">
        <GlobalSearch />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <NotificationsMenu />
        <UserMenu />
      </div>
    </div>
  );
}
