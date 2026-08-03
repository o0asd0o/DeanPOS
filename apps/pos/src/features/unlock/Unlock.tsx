import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "ui";

import { verifyPin } from "contract/src/pin.ts";

import { PinPad } from "@/components/PinPad.tsx";
import { useActingUser } from "@/lib/acting-user.tsx";
import { readDeviceIdentity } from "@/lib/device-token.ts";
import { usePinLockAnnouncement, usePinLockTick } from "@/lib/pin-lock-tick.ts";
import {
  pinLockUntil,
  readPinThrottle,
  recordPinFailure,
  recordPinSuccess,
} from "@/lib/pin-throttle.ts";
import { usePinRoster } from "./__common/queries.ts";

// No real userId is ever "" — used to read only the Device half of the lock
// (record 059 Q1's two counters) without a User selected.
const DEVICE_ONLY_KEY = "";

// The unlock screen (issue 10, record 057 Q4). Verified locally against the
// last synced roster (usePinRoster) — there is no online unlock path.
// Locking (record 059) is on-device only and deters a bystander, not an attacker.
export function Unlock() {
  const roster = usePinRoster();
  const identity = readDeviceIdentity();
  const { setActingUser } = useActingUser();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const selectedUser = roster?.users.find((user) => user.userId === selectedId) ?? null;

  const throttleState = readPinThrottle();
  const deviceLockedUntil = pinLockUntil(throttleState, DEVICE_ONLY_KEY);
  const lockedUntil = selectedUser
    ? pinLockUntil(throttleState, selectedUser.userId)
    : deviceLockedUntil;
  const isDeviceLock = deviceLockedUntil !== null;
  const isLocked = lockedUntil !== null;
  usePinLockTick(lockedUntil);
  const [srStatus, setSrStatus] = usePinLockAnnouncement(
    isLocked,
    isDeviceLock,
    lockedUntil,
    selectedUser?.displayName,
  );

  const setPinDigits = (next: string) => {
    setPin(next);
    setSrStatus("");
  };

  const handleSelect = (userId: string) => {
    if (isDeviceLock) return;
    setSelectedId(userId);
    setPin("");
    setError(null);
    pinInputRef.current?.focus();
  };

  const canUnlock =
    selectedUser !== null && selectedUser.pinHash !== null && pin.length >= 4 && !isLocked;

  const handleUnlock = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canUnlock || !selectedUser || pending) return;

    setPending(true);
    setError(null);
    const ok = await verifyPin(pin, selectedUser.pinHash!);
    setPending(false);

    if (!ok) {
      recordPinFailure(selectedUser.userId);
      const justLocked = pinLockUntil(readPinThrottle(), selectedUser.userId) !== null;
      setPin("");
      // A lock replaces the error, never joins it — the strip covers it.
      setError(justLocked ? null : "That PIN is not correct");
      return;
    }
    recordPinSuccess(selectedUser.userId);
    setActingUser({ userId: selectedUser.userId, displayName: selectedUser.displayName });
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{identity ? `${identity.storeName} · ${identity.name}` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!roster || roster.users.length === 0 ? (
            <p role="status">
              No one is set up at this till yet. Connect once to load the store&rsquo;s users
            </p>
          ) : (
            <>
              <span id="who-is-on-the-till" className="sr-only">
                Who is on the till
              </span>
              <div
                role="group"
                aria-labelledby="who-is-on-the-till"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {roster.users.map((user) => (
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

              <form onSubmit={handleUnlock} className="flex flex-col gap-4">
                <PinPad
                  inputRef={pinInputRef}
                  pin={pin}
                  onPinChange={setPinDigits}
                  lockedUntil={lockedUntil}
                  lockMessage={
                    isDeviceLock
                      ? "Too many attempts — locked for"
                      : `Too many attempts — ${selectedUser?.displayName} locked for`
                  }
                  srStatus={srStatus}
                  trailing={
                    <Button type="submit" aria-disabled={!canUnlock || pending}>
                      {pending ? "Unlocking…" : "Unlock"}
                    </Button>
                  }
                />

                {selectedUser && selectedUser.pinHash === null && (
                  <p role="alert">
                    {selectedUser.displayName} has no PIN yet. They set one in the back office, from
                    their account menu
                  </p>
                )}
                {error && !isLocked && <p role="alert">{error}</p>}
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
