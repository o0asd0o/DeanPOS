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
import type { DeviceOutput } from "./helpers.ts";

// Revocation is immediate and permanent — never a hard delete (issue 09
// acceptance criteria). Its own code is never reissued at that Store.
export function RevokeDialog({
  device,
  open,
  onOpenChange,
  onRevoked,
}: {
  device: DeviceOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRevoked: (name: string) => void;
}) {
  const revokeDevice = useRevokeDeviceMutation();

  const handleRevoke = async () => {
    if (revokeDevice.isPending) return;
    const result = await revokeDevice.mutateAsync({ id: device.id });
    if (!result) return;
    onRevoked(device.name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke {device.name}?</DialogTitle>
          <DialogDescription>
            This terminal can no longer sign in or take sales. Its code, {device.code}, is never
            reissued at this Store — enrol a new Device if this counter is still in use.
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
