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

import type { VariantOutput } from "./helpers.ts";

export function ArchiveVariantDialog({
  variant,
  open,
  busy,
  failed,
  onOpenChange,
  onConfirm,
}: {
  variant: VariantOutput;
  open: boolean;
  busy: boolean;
  failed: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {variant.name}?</DialogTitle>
          <DialogDescription>
            This variant leaves every terminal. If it is the last one, the menu item is no longer
            sellable. Reactivate brings it back.
          </DialogDescription>
        </DialogHeader>
        {failed && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t archive the variant
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button danger aria-disabled={busy} onClick={onConfirm}>
            {busy ? "Archiving…" : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
