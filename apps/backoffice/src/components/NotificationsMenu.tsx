import { BellIcon } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "ui";

// No notification source exists yet, so the panel states that rather than
// implying one is loading. The control is here because the reference draws it
// beside the account menu — `.scratch/decisions/048`.
export function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 bg-card hover:bg-hover"
          aria-label="Notifications"
        >
          <BellIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <p className="px-2 py-1.5 text-sm text-muted-foreground">Nothing yet.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
