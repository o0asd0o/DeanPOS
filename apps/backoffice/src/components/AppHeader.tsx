import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

import { GlobalSearch } from "./GlobalSearch.tsx";
import { firstNameFromEmail } from "./helpers.ts";
import { NotificationsMenu } from "./NotificationsMenu.tsx";
import { UserMenu } from "./UserMenu.tsx";

// The reference's content-column bar (`.scratch/decisions/048`): greeting and
// search left, notifications and the account menu right. A `<div>`, not a
// `<header>` — record 021 keeps the page's one banner in the sidebar.
export function AppHeader() {
  const { orpc } = useRouteContext({ from: "/_shell" });
  const me = useQuery(orpc.auth.me.queryOptions());
  const email = me.data?.authenticated ? me.data.email : undefined;

  return (
    <div className="mx-4 flex items-center gap-3 border-b py-4">
      <p className="hidden font-medium whitespace-nowrap sm:block">
        👋 Hi {firstNameFromEmail(email)}
      </p>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-2">
        <NotificationsMenu />
        <UserMenu />
      </div>
    </div>
  );
}
