import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "ui";

import { verifyPin } from "contract/src/pin.ts";

import { PinPad } from "@/components/PinPad.tsx";
import { useActingUser } from "@/lib/acting-user.tsx";
import { usePinLockAnnouncement, usePinLockTick } from "@/lib/pin-lock-tick.ts";
import type { PinRosterUser } from "@/lib/pin-roster.ts";
import {
  pinLockUntil,
  readPinThrottle,
  recordPinFailure,
  recordPinSuccess,
} from "@/lib/pin-throttle.ts";

// No real userId is ever "" — reads only the Device half of the lock
// (record 059 Q1) before an approver is chosen.
const DEVICE_ONLY_KEY = "";

// A full unlock, not an override-scoped session — the manager who enters
// their PIN here becomes the acting User, same as any unlock.
export function ManagerUnlockDialog({
  open,
  onOpenChange,
  approvers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approvers: PinRosterUser[];
}) {
  const { setActingUser } = useActingUser();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedUser = approvers.find((user) => user.userId === selectedId) ?? null;

  const throttleState = readPinThrottle();
  const deviceLockedUntil = pinLockUntil(throttleState, DEVICE_ONLY_KEY);
  const isDeviceLock = deviceLockedUntil !== null;
  const lockedUntil = selectedUser
    ? pinLockUntil(throttleState, selectedUser.userId)
    : deviceLockedUntil;
  const isLocked = lockedUntil !== null;
  usePinLockTick(lockedUntil);
  const [srStatus, setSrStatus] = usePinLockAnnouncement(
    isLocked,
    isDeviceLock,
    lockedUntil,
    selectedUser?.displayName,
  );

  const reset = () => {
    setSelectedId(null);
    setPin("");
    setError(null);
    setSrStatus("");
  };

  const close = () => {
    if (pending) return;
    reset();
    onOpenChange(false);
  };

  const handleSelect = (userId: string) => {
    if (isDeviceLock) return;
    setSelectedId(userId);
    setPin("");
    setError(null);
  };

  // Unlock stays live whenever there is something to complete, and the click
  // names the first unmet step — a disabled button explains nothing. Only an
  // empty roster, a lock or a request in flight actually disables it.
  const handleUnlock = async () => {
    if (pending || isLocked) return;
    if (!selectedUser) {
      setError("Choose who is signing in");
      return;
    }
    // The no-PIN-yet case already stands as its own alert below.
    if (selectedUser.pinHash === null) return;
    if (pin.length < 4) {
      setError("Enter your PIN");
      return;
    }

    setPending(true);
    setError(null);
    const ok = await verifyPin(pin, selectedUser.pinHash!);
    setPending(false);

    if (!ok) {
      recordPinFailure(selectedUser.userId);
      const justLocked = pinLockUntil(readPinThrottle(), selectedUser.userId) !== null;
      setPin("");
      setError(justLocked ? null : "That PIN is not correct");
      return;
    }
    recordPinSuccess(selectedUser.userId);
    setActingUser({ userId: selectedUser.userId, displayName: selectedUser.displayName });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : close())}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manager sign-in</DialogTitle>
        </DialogHeader>

        {approvers.length === 0 ? (
          <p role="status">
            No manager is set up at this till yet. An admin assigns one in the back office
          </p>
        ) : (
          <>
            <span id="who-is-signing-in" className="sr-only">
              Who is signing in
            </span>
            <div
              role="group"
              aria-labelledby="who-is-signing-in"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {approvers.map((user) => (
                <Button
                  key={user.userId}
                  type="button"
                  variant="outline"
                  aria-pressed={user.userId === selectedId}
                  aria-disabled={isDeviceLock}
                  onClick={() => handleSelect(user.userId)}
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
                isDeviceLock
                  ? "Too many attempts — locked for"
                  : `Too many attempts — ${selectedUser?.displayName} locked for`
              }
              srStatus={srStatus}
              trailing={null}
            />

            {selectedUser && selectedUser.pinHash === null && (
              <p role="alert" className="text-sm text-destructive">
                {selectedUser.displayName} has no PIN yet. They set one in the back office, from
                their account menu
              </p>
            )}
            {error && !isLocked && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" aria-disabled={pending} onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            aria-disabled={pending || isLocked || approvers.length === 0}
            onClick={() => void handleUnlock()}
          >
            {pending ? "Unlocking…" : "Unlock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
