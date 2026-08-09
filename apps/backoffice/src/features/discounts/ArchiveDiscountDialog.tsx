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

import { useArchiveDiscountMutation } from "./__common/queries.ts";
import type { DiscountOutput } from "./helpers.ts";

export function ArchiveDiscountDialog({
  discount,
  open,
  onOpenChange,
  onArchived,
}: {
  discount: DiscountOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived: (name: string) => void;
}) {
  const archive = useArchiveDiscountMutation();
  const handleArchive = async () => {
    if (archive.isPending) return;
    const result = await archive.mutateAsync({ id: discount.discountId });
    if (result) onArchived(discount.name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {discount.name}?</DialogTitle>
          <DialogDescription>
            This removes the discount from the cashier&rsquo;s choices. Past sales stay unchanged,
            and you can reactivate it later.
          </DialogDescription>
        </DialogHeader>
        {archive.isError ? (
          <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm">
            Couldn&rsquo;t archive the discount.
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button danger aria-disabled={archive.isPending} onClick={handleArchive}>
            {archive.isPending ? "Archiving…" : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
