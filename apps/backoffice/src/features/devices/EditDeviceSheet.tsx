import { useForm } from "@tanstack/react-form";
import { CheckIcon, XIcon } from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useSubmitGate,
} from "ui";

import { SheetForm } from "@/components/SheetForm.tsx";
import { useUpdateDeviceMutation } from "./__common/queries.ts";
import { useLastNonNull } from "./helpers.ts";
import type { AssignableUser, DeviceOutput } from "./helpers.ts";

// The value "open" stands in for `null` (open-to-all) inside the Select,
// which cannot carry a null item value — translated back at submit time.
const OPEN_TO_ALL = "open";

// One editor for a Device's name and assignment (record 056 Q5), saving both
// in a single `device.update` call. Renaming stays available on a revoked
// Device — it still names past sales — and only a User currently assigned to
// the Device's Store is offered here, refused server-side either way.
export function EditDeviceSheet({
  device,
  users,
  onClose,
  onSaved,
}: {
  device: DeviceOutput | null;
  users: {
    id: string;
    firstName: string;
    lastName: string;
    active: boolean;
    storeIds: string[];
  }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // The parent nulls `device` on close, but this sheet stays mounted for the
  // exit animation — keep editing the Device it was opened on.
  const shownDevice = useLastNonNull(device);
  const updateDevice = useUpdateDeviceMutation();

  // Only a User currently assigned to the Device's Store is offered here,
  // refused server-side either way.
  const eligibleUsers: AssignableUser[] = shownDevice
    ? users.filter((user) => user.active && user.storeIds.includes(shownDevice.storeId))
    : [];

  const form = useForm({
    defaultValues: {
      name: shownDevice?.name ?? "",
      assignment: shownDevice?.assignedUserId ?? OPEN_TO_ALL,
    },
    onSubmit: async ({ value }) => {
      if (!shownDevice) return;
      const updated = await updateDevice.mutateAsync({
        id: shownDevice.id,
        name: value.name.trim(),
        assignedUserId: value.assignment === OPEN_TO_ALL ? null : value.assignment,
      });
      if (!updated) return;
      onSaved();
    },
  });

  const saving = updateDevice.isPending;
  const gate = useSubmitGate(form, { busy: saving });

  if (!shownDevice) return null;

  return (
    <SheetForm
      title={`Edit ${shownDevice.name}`}
      busy={saving}
      onSubmit={gate.submit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            <XIcon />
            Cancel
          </Button>
          <Button type="submit" aria-disabled={gate.blocked}>
            <CheckIcon />
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="edit-device-name">Name</label>
            <Input
              id="edit-device-name"
              name={field.name}
              required
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </div>
        )}
      </form.Field>
      <form.Field name="assignment">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="edit-device-assignment">Assigned employee</label>
            <Select value={field.state.value} onValueChange={field.handleChange}>
              <SelectTrigger id="edit-device-assignment">
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
        )}
      </form.Field>
      {updateDevice.isError && (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground">
          Couldn&rsquo;t update the device
        </div>
      )}
    </SheetForm>
  );
}
