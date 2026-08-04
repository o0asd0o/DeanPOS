import { useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  useSubmitGate,
} from "ui";

import { verifyPin } from "contract/src/pin.ts";

import { PinPad } from "@/components/PinPad.tsx";
import { usePinLockAnnouncement, usePinLockTick } from "@/lib/pin-lock-tick.ts";
import { readPinRoster } from "@/lib/pin-roster.ts";
import {
  pinLockUntil,
  readPinThrottle,
  recordPinFailure,
  recordPinSuccess,
} from "@/lib/pin-throttle.ts";
import { useRecordOverrideMutation } from "./__common/queries.ts";

export type OverrideActionType =
  | "void_paid_order"
  | "refund"
  | "line_price_override"
  | "drawer_variance";

// 054's precedent: reversible copy on a `<datalist>`, never a DB enum.
const REASON_SUGGESTIONS = [
  "Rung up in error",
  "Customer changed their mind",
  "Wrong price entered",
  "Cash count corrected",
];

// No real userId is ever "" — reads only the Device half of the lock
// (record 059 Q1) before an approver is chosen.
const DEVICE_ONLY_KEY = "";

// The manager-approval prompt (issue 12, record 060 Q5) — a controlled
// Dialog with no trigger, mounted by checkout/drawer-sessions later. PIN
// verifies on the terminal; the server verifies the approver only.
export function OverridePrompt({
  open,
  onOpenChange,
  action,
  subject,
  onApproved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: OverrideActionType;
  subject: string;
  onApproved: (overrideId: string) => void;
}) {
  const roster = readPinRoster();
  const approvers = (roster?.users ?? []).filter((user) => user.canApproveOverride);

  const [approverId, setApproverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const recordOverride = useRecordOverrideMutation();
  const approver = approvers.find((user) => user.userId === approverId) ?? null;

  const throttleState = readPinThrottle();
  const deviceLockedUntil = pinLockUntil(throttleState, DEVICE_ONLY_KEY);
  const isDeviceLock = deviceLockedUntil !== null;
  const lockedUntil = pinLockUntil(throttleState, approver ? approver.userId : DEVICE_ONLY_KEY);
  const isLocked = lockedUntil !== null;
  usePinLockTick(lockedUntil);
  const [srStatus, setSrStatus] = usePinLockAnnouncement(
    isLocked,
    isDeviceLock,
    lockedUntil,
    approver?.displayName,
  );

  const form = useForm({
    defaultValues: { reason: "", note: "", pin: "" },
    onSubmit: async ({ value }) => {
      if (!approver || approver.pinHash === null || isLocked || pending) return;
      if (value.reason.trim() === "" || value.pin.length < 4) return;

      setPending(true);
      setError(null);
      const ok = await verifyPin(value.pin, approver.pinHash);
      if (!ok) {
        recordPinFailure(approver.userId);
        const justLocked = pinLockUntil(readPinThrottle(), approver.userId) !== null;
        form.setFieldValue("pin", "");
        setPending(false);
        setError(justLocked ? null : "That PIN is not correct");
        return;
      }

      const result = await recordOverride
        .mutateAsync({
          approverUserId: approver.userId,
          actionType: action,
          reason: value.reason.trim(),
          note: value.note.trim() === "" ? undefined : value.note.trim(),
          approvedAt: new Date(),
        })
        .catch(() => "unreachable" as const);
      setPending(false);

      // Two distinguishable failures (record 061): a rejected fetch never
      // reached the server, a refusal did. Neither clears the form or calls
      // onApproved, and the PIN lock clears only once recording succeeds.
      if (result === "unreachable") {
        setError(
          "The till couldn't reach the server. The approval was not recorded — try again in a moment",
        );
        return;
      }
      if (!result.ok) {
        setError("Couldn't record the approval");
        return;
      }
      recordPinSuccess(approver.userId);
      reset();
      onOpenChange(false);
      onApproved(result.overrideId);
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const gate = useSubmitGate(form, { busy: pending });

  const reset = () => {
    setApproverId(null);
    form.reset();
    setError(null);
    setSrStatus("");
  };

  // Refuses every close path while a recording is in flight — Cancel, Escape,
  // outside click and the header X all route through here — so a delayed
  // success cannot call onApproved after the cashier tried to leave.
  const close = () => {
    if (pending) return;
    reset();
    onOpenChange(false);
  };

  const handleSelectApprover = (userId: string) => {
    if (isDeviceLock) return;
    setApproverId(userId);
    form.setFieldValue("pin", "");
    setError(null);
  };

  const canApprove =
    approver !== null &&
    approver.pinHash !== null &&
    values.pin.length >= 4 &&
    values.reason.trim() !== "" &&
    !isLocked;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : close())}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manager approval required</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{subject}</p>

        <form.Field name="reason">
          {(field) => (
            <div className="flex flex-col gap-2">
              <label htmlFor="override-reason">Reason (required)</label>
              <Input
                id="override-reason"
                name={field.name}
                list="override-reasons"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <datalist id="override-reasons">
                {REASON_SUGGESTIONS.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </div>
          )}
        </form.Field>

        <form.Field name="note">
          {(field) => (
            <div className="flex flex-col gap-2">
              <label htmlFor="override-note">Note (optional)</label>
              <Input
                id="override-note"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>

        <div className="flex flex-col gap-2">
          <span id="who-is-approving" className="text-sm font-medium">
            Manager PIN
          </span>
          {approvers.length === 0 ? (
            <p role="status">
              No manager is set up at this till yet. An admin assigns one in the back office
            </p>
          ) : (
            <>
              <div
                role="group"
                aria-labelledby="who-is-approving"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {approvers.map((user) => (
                  <Button
                    key={user.userId}
                    type="button"
                    variant="outline"
                    aria-pressed={user.userId === approverId}
                    aria-disabled={isDeviceLock}
                    onClick={() => handleSelectApprover(user.userId)}
                  >
                    {user.displayName}
                  </Button>
                ))}
              </div>

              <PinPad
                pin={values.pin}
                onPinChange={(next) => {
                  form.setFieldValue("pin", next);
                  setSrStatus("");
                }}
                lockedUntil={lockedUntil}
                lockMessage={
                  approver
                    ? `Too many attempts — ${approver.displayName} locked for`
                    : "Too many attempts — locked for"
                }
                srStatus={srStatus}
                trailing={null}
              />

              {approver && approver.pinHash === null && (
                <p role="alert">
                  {approver.displayName} has no PIN yet. They set one in the back office, from their
                  account menu
                </p>
              )}
              {error && !isLocked && <p role="alert">{error}</p>}
            </>
          )}
        </div>

        <DialogFooter className="mt-2 grid grid-cols-2 gap-2 border-t pt-4">
          <Button type="button" variant="outline" aria-disabled={pending} onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            aria-disabled={gate.blocked || !canApprove}
            onClick={() => gate.submit()}
          >
            {pending ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
