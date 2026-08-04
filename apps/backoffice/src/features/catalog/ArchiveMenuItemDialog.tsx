import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui";

import { useArchiveMenuItemMutation } from "./__common/queries.ts";
import type { MenuItemOutput } from "./helpers.ts";

export function ArchiveMenuItemDialog({
  menuItem,
  open,
  onOpenChange,
  onArchived,
}: {
  menuItem: MenuItemOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived: (name: string) => void;
}) {
  const archiveMenuItem = useArchiveMenuItemMutation();

  const handleArchive = async () => {
    if (archiveMenuItem.isPending) return;
    const result = await archiveMenuItem.mutateAsync({ id: menuItem.id });
    if (!result) return;
    onArchived(menuItem.name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {menuItem.name}?</DialogTitle>
          <DialogDescription>
            This menu item leaves every terminal. Past orders stay intact, and Reactivate brings it
            back.
          </DialogDescription>
        </DialogHeader>
        {archiveMenuItem.isError && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t archive the menu item
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button danger aria-disabled={archiveMenuItem.isPending} onClick={handleArchive}>
            {archiveMenuItem.isPending ? "Archiving…" : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
