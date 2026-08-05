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

import { useArchiveCategoryMutation } from "./__common/queries.ts";
import type { CategoryOutput } from "@/features/catalog/helpers.ts";

// Record 041 shape — copy states MenuItem count taken off every terminal (issue 01).
export function ArchiveCategoryDialog({
  category,
  menuItemCount,
  open,
  onOpenChange,
  onArchived,
}: {
  category: CategoryOutput;
  menuItemCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived: (name: string) => void;
}) {
  const archiveCategory = useArchiveCategoryMutation();

  const handleArchive = async () => {
    if (archiveCategory.isPending) return;
    const result = await archiveCategory.mutateAsync({ id: category.id });
    if (!result) return;
    onArchived(category.name);
  };

  const itemLabel = menuItemCount === 1 ? "1 menu item" : `${menuItemCount} menu items`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {category.name}?</DialogTitle>
          <DialogDescription>
            This takes {itemLabel} off every terminal. Past orders stay intact, and Reactivate
            restores menu items that were never themselves archived.
          </DialogDescription>
        </DialogHeader>
        {archiveCategory.isError && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t archive the category
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button danger aria-disabled={archiveCategory.isPending} onClick={handleArchive}>
            {archiveCategory.isPending ? "Archiving…" : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
