import { useEffect, useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from "ui";

import { verifyPin } from "contract/src/pin.ts";

import { PinPad } from "@/components/PinPad.tsx";
import { usePinLockTick } from "@/lib/pin-lock-tick.ts";
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
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [srStatus, setSrStatus] = useState("");

  const recordOverride = useRecordOverrideMutation();
  const approver = approvers.find((user) => user.userId === approverId) ?? null;

  const throttleState = readPinThrottle();
  const deviceLockedUntil = pinLockUntil(throttleState, DEVICE_ONLY_KEY);
  const isDeviceLock = deviceLockedUntil !== null;
  const lockedUntil = pinLockUntil(throttleState, approver ? approver.userId : DEVICE_ONLY_KEY);
  const isLocked = lockedUntil !== null;
  usePinLockTick(lockedUntil);

  // Announces exactly on engage and on real (time-based) lift, verbatim
  // from Unlock.tsx (M4) so the two surfaces cannot drift.
  const wasLockedRef = useRef(false);
  const lastLockInstantRef = useRef<number | null>(null);
  useEffect(() => {
    if (isLocked && !wasLockedRef.current) {
      setSrStatus(
        isDeviceLock
          ? "Too many attempts. This till is locked for 2 minutes"
          : `Too many attempts. ${approver?.displayName} is locked for 2 minutes. Another user can still unlock this till`,
      );
    } else if (!isLocked && wasLockedRef.current) {
      const instant = lastLockInstantRef.current;
      setSrStatus(
        instant !== null && Date.now() >= instant ? "The lock has lifted. Try your PIN again" : "",
      );
    }
    wasLockedRef.current = isLocked;
    if (isLocked) lastLockInstantRef.current = lockedUntil;
  }, [isLocked, isDeviceLock, approver?.displayName, lockedUntil]);

  const reset = () => {
    setApproverId(null);
    setPin("");
    setReason("");
    setNote("");
    setError(null);
    setSrStatus("");
  };

  // Refuses every close path while a recording is in flight (M6) — Cancel,
  // Escape, outside click and the header X all route through here — so a
  // delayed success cannot call onApproved after the cashier tried to leave.
  const close = () => {
    if (pending) return;
    reset();
    onOpenChange(false);
  };

  const handleSelectApprover = (userId: string) => {
    if (isDeviceLock) return;
    setApproverId(userId);
    setPin("");
    setError(null);
  };

  const canApprove =
    approver !== null &&
    approver.pinHash !== null &&
    pin.length >= 4 &&
    reason.trim() !== "" &&
    !isLocked;

  const handleApprove = async () => {
    if (!canApprove || !approver || pending) return;

    setPending(true);
    setError(null);
    const ok = await verifyPin(pin, approver.pinHash!);
    if (!ok) {
      recordPinFailure(approver.userId);
      const justLocked = pinLockUntil(readPinThrottle(), approver.userId) !== null;
      setPin("");
      setPending(false);
      setError(justLocked ? null : "That PIN is not correct");
      return;
    }

    const result = await recordOverride
      .mutateAsync({
        approverUserId: approver.userId,
        actionType: action,
        reason: reason.trim(),
        note: note.trim() === "" ? undefined : note.trim(),
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
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : close())}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manager approval required</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{subject}</p>

        <div className="flex flex-col gap-2">
          <label htmlFor="override-reason">Reason (required)</label>
          <Input
            id="override-reason"
            list="override-reasons"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <datalist id="override-reasons">
            {REASON_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="override-note">Note (optional)</label>
          <Input
            id="override-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

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
                pin={pin}
                onPinChange={(next) => {
                  setPin(next);
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
          <Button type="button" aria-disabled={!canApprove || pending} onClick={handleApprove}>
            {pending ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
