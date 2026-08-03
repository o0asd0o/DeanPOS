import { SearchIcon } from "lucide-react";
import { Input } from "ui";

import { NotificationsMenu } from "./NotificationsMenu.tsx";
import { UserMenu } from "./UserMenu.tsx";

// The reference's content-column bar: search on the left, notifications and the
// account menu on the right (`.scratch/decisions/048`). A `<div>`, not a
// `<header>` — record 021 keeps the page's one banner in the sidebar.
export function AppHeader() {
  return (
    <div className="flex items-center gap-3 border-b p-4">
      <form role="search" className="relative max-w-md flex-1" onSubmit={(e) => e.preventDefault()}>
        <SearchIcon
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input type="search" aria-label="Search" placeholder="Search" className="pl-9" />
      </form>
      <div className="ml-auto flex items-center gap-1">
        <NotificationsMenu />
        <UserMenu />
      </div>
    </div>
  );
}
