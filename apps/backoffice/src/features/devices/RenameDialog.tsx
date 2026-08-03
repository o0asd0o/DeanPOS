import { useState } from "react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "ui";

import { useRenameDeviceMutation } from "./__common/queries.ts";
import type { DeviceOutput } from "./helpers.ts";

// Renaming stays available on a revoked Device — it still names past sales
// (record 056 Q5).
export function RenameDialog({
  device,
  open,
  onOpenChange,
  onRenamed,
}: {
  device: DeviceOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: (name: string) => void;
}) {
  const [name, setName] = useState(device.name);
  const renameDevice = useRenameDeviceMutation();

  const handleSave = async () => {
    if (renameDevice.isPending || name.trim() === "") return;
    const result = await renameDevice.mutateAsync({ id: device.id, name: name.trim() });
    if (!result) return;
    onRenamed(name.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {device.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="rename-device-name">Name</label>
          <Input
            id="rename-device-name"
            autoFocus
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        {renameDevice.isError && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t rename the device
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button aria-disabled={renameDevice.isPending || name.trim() === ""} onClick={handleSave}>
            {renameDevice.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
