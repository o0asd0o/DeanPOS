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

import { useResetUserPinMutation } from "./__common/queries.ts";
import type { UserOutput } from "./helpers.ts";

// `admin`-only PIN reset (issue 10, record 058) — no field: the reset
// clears the hash to NULL, the User sets a new one themselves.
export function ResetPinDialog({
  user,
  open,
  onOpenChange,
  onReset,
}: {
  user: UserOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
}) {
  const resetPin = useResetUserPinMutation();

  const handleReset = async () => {
    if (resetPin.isPending) return;
    try {
      const result = await resetPin.mutateAsync({ id: user.id });
      if (!result.ok) return;
      resetPin.reset();
      onReset();
    } catch {
      // isError is already set on the mutation; swallow so it doesn't also
      // surface as an unhandled promise rejection.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset PIN for {user.email}?</DialogTitle>
          <DialogDescription>
            This clears their PIN. They set a new one themselves before they can unlock a till again
          </DialogDescription>
        </DialogHeader>
        {resetPin.isError && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t reset the PIN
          </div>
        )}
        <DialogFooter className="mt-2 border-t pt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button aria-disabled={resetPin.isPending} onClick={handleReset}>
            {resetPin.isPending ? "Resetting…" : "Reset PIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
