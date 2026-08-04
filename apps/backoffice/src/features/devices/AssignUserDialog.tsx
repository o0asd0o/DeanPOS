import { useState } from "react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "ui";

import type { UserOutput } from "@/features/users/helpers.ts";
import { useSetAssignedUserMutation } from "./__common/queries.ts";
import type { DeviceOutput } from "./helpers.ts";

// The value "open" stands in for `null` (open-to-all) inside the Select,
// which cannot carry a null item value — translated back at submit time.
const OPEN_TO_ALL = "open";

// Restricts or clears which User this Device's unlock screen offers (issue
// 17). Only a User currently assigned to the Device's Store is offered here
// — the server refuses anyone else regardless of this list (record 056 Q5).
export function AssignUserDialog({
  device,
  eligibleUsers,
  open,
  onOpenChange,
  onAssigned,
}: {
  device: DeviceOutput;
  eligibleUsers: UserOutput[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: (assignedUserId: string | null) => void;
}) {
  const [selection, setSelection] = useState(device.assignedUserId ?? OPEN_TO_ALL);
  const setAssignedUser = useSetAssignedUserMutation();

  const handleSave = async () => {
    if (setAssignedUser.isPending) return;
    const userId = selection === OPEN_TO_ALL ? null : selection;
    const result = await setAssignedUser.mutateAsync({ id: device.id, userId });
    if (!result) return;
    onAssigned(userId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restrict {device.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="assign-user-select">Assigned employee</label>
          <Select value={selection} onValueChange={setSelection}>
            <SelectTrigger id="assign-user-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OPEN_TO_ALL}>Open to all</SelectItem>
              {eligibleUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {`${user.firstName} ${user.lastName}`.trim()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {setAssignedUser.isError && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t update the assignment
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button aria-disabled={setAssignedUser.isPending} onClick={() => void handleSave()}>
            {setAssignedUser.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
