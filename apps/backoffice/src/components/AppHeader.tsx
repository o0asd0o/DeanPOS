import { NotificationsMenu } from "./NotificationsMenu.tsx";
import { UserMenu } from "./UserMenu.tsx";

// The reference's content-column bar (`.scratch/decisions/048`). A `<div>`, not
// a `<header>` — record 021 keeps the page's one banner in the sidebar.
export function AppHeader() {
  return (
    <div className="flex items-center justify-end gap-2 border-b p-4">
      <NotificationsMenu />
      <UserMenu />
    </div>
  );
}
