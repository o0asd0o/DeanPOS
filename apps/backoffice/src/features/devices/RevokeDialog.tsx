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

import { useRevokeDeviceMutation } from "./__common/queries.ts";
import { useLastNonNull } from "./helpers.ts";
import type { DeviceOutput } from "./helpers.ts";

// Revocation is immediate and permanent — never a hard delete (issue 09
// acceptance criteria). Its own code is never reissued at that Store.
export function RevokeDialog({
  device,
  open,
  onOpenChange,
  onRevoked,
}: {
  device: DeviceOutput | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRevoked: (name: string) => void;
}) {
  // The parent nulls `device` on close, but this dialog stays mounted for the
  // exit animation — keep naming the Device until it is gone.
  const shownDevice = useLastNonNull(device);
  const revokeDevice = useRevokeDeviceMutation();

  const handleRevoke = async () => {
    if (revokeDevice.isPending || !shownDevice) return;
    const result = await revokeDevice.mutateAsync({ id: shownDevice.id });
    if (!result) return;
    onRevoked(shownDevice.name);
  };

  if (!shownDevice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke {shownDevice.name}?</DialogTitle>
          <DialogDescription>
            This terminal can no longer sign in or take sales. Its code, {shownDevice.code}, is
            never reissued at this Store — enrol a new Device if this counter is still in use.
          </DialogDescription>
        </DialogHeader>
        {revokeDevice.isError && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t revoke the device
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button danger aria-disabled={revokeDevice.isPending} onClick={handleRevoke}>
            {revokeDevice.isPending ? "Revoking…" : "Revoke"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
