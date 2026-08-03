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

import { useDeactivateUserMutation } from "./__common/queries.ts";
import type { UserOutput } from "./helpers.ts";

// The deactivation confirmation (record 044 §4) — structurally the same as
// the Stores screen's. Reactivation is not confirmed; only this is.
export function DeactivateDialog({
  user,
  onOpenChange,
  onDeactivated,
}: {
  user: UserOutput;
  onOpenChange: (open: boolean) => void;
  onDeactivated: (email: string) => void;
}) {
  const deactivateUser = useDeactivateUserMutation();

  const handleDeactivate = async () => {
    if (deactivateUser.isPending) return;
    try {
      const result = await deactivateUser.mutateAsync({ id: user.id });
      if (!result) return;
      onDeactivated(user.email);
    } catch {
      // isError is already set on the mutation; swallow so it doesn't also
      // surface as an unhandled promise rejection.
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate {user.email}?</DialogTitle>
          <DialogDescription>
            This person is signed out now and cannot use the terminal or the back office, their past
            sales stay attributed to them, and Reactivate restores their access
          </DialogDescription>
        </DialogHeader>
        {deactivateUser.isError && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t update the user
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button danger aria-disabled={deactivateUser.isPending} onClick={handleDeactivate}>
            {deactivateUser.isPending ? "Deactivating…" : "Deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
