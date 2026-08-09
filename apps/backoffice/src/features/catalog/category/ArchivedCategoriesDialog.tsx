import { ArchiveIcon, CheckCircle2Icon, RotateCcwIcon } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui";

import type { CategoryOutput } from "@/features/catalog/helpers.ts";

export function ArchivedCategoriesDialog({
  categories,
  open,
  onOpenChange,
  onReactivate,
  reactivating,
}: {
  categories: CategoryOutput[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReactivate: (category: CategoryOutput) => void;
  reactivating: boolean;
}) {
  const countLabel =
    categories.length === 1 ? "1 archived category" : `${categories.length} archived categories`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Archived categories</DialogTitle>
          <DialogDescription>
            {countLabel} are hidden from terminals and the active catalog selector.
          </DialogDescription>
        </DialogHeader>
        <div className="scrollbar-slim flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-warning-tint text-status-warning-tone">
                <ArchiveIcon aria-hidden="true" className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{category.name}</p>
                <Badge variant="secondary" className="mt-1">
                  Archived
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="tap-target shrink-0"
                disabled={reactivating}
                onClick={() => onReactivate(category)}
              >
                <RotateCcwIcon aria-hidden="true" />
                {reactivating ? "Reactivating…" : "Reactivate"}
              </Button>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
              <CheckCircle2Icon aria-hidden="true" className="size-6 text-status-success-tone" />
              <p className="text-sm font-medium">No archived categories</p>
              <p className="text-sm text-muted-foreground">
                Everything is available in the catalog.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
