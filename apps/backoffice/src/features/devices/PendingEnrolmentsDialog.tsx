import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui";

import type { PendingCode } from "./helpers.ts";
import { PendingEnrolmentNotice } from "./PendingEnrolmentNotice.tsx";

// Every waiting enrolment, wider than a stock dialog because each row carries
// a name, a Store, and two actions.
export function PendingEnrolmentsDialog({
  codes,
  storeNameById,
  removingId,
  open,
  onOpenChange,
  onView,
  onRemove,
}: {
  codes: PendingCode[];
  storeNameById: Map<string, string>;
  removingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onView: (pending: PendingCode) => void;
  onRemove: (pending: PendingCode) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enrolments waiting</DialogTitle>
          <DialogDescription>
            Each code is valid for ten minutes from the moment it was generated.
          </DialogDescription>
        </DialogHeader>
        <div className="scrollbar-slim flex max-h-96 flex-col gap-2 overflow-y-auto">
          {codes.map((pending) => (
            <PendingEnrolmentNotice
              key={pending.id}
              pending={pending}
              storeName={storeNameById.get(pending.storeId) ?? ""}
              removing={removingId === pending.id}
              onView={onView}
              onRemove={onRemove}
            />
          ))}
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
