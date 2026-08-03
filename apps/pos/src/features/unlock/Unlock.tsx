import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "ui";

import { verifyPin } from "contract/src/pin.ts";

import { useActingUser } from "@/lib/acting-user.tsx";
import { readDeviceIdentity } from "@/lib/device-token.ts";
import {
  pinLockUntil,
  readPinThrottle,
  recordPinFailure,
  recordPinSuccess,
} from "@/lib/pin-throttle.ts";
import { usePinRoster } from "./__common/queries.ts";

const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

// No real userId is ever "" — used to read only the Device half of the lock
// (record 059 Q1's two counters) without a User selected.
const DEVICE_ONLY_KEY = "";

function formatClock(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

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
  const [srStatus, setSrStatus] = useState("");
  const [, forceTick] = useState(0);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const selectedUser = roster?.users.find((user) => user.userId === selectedId) ?? null;

  const throttleState = readPinThrottle();
  const deviceLockedUntil = pinLockUntil(throttleState, DEVICE_ONLY_KEY);
  const lockedUntil = selectedUser
    ? pinLockUntil(throttleState, selectedUser.userId)
    : deviceLockedUntil;
  const isDeviceLock = deviceLockedUntil !== null;
  const isLocked = lockedUntil !== null;

  // The whole lift mechanism: one interval, keyed on the lock instant,
  // running only while locked, cleared on unmount and on lift.
  useEffect(() => {
    if (lockedUntil === null) return;
    const id = setInterval(() => forceTick((tick) => tick + 1), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  // Announces exactly on engage and on real (time-based) lift — switching to
  // a different, unlocked User clears the strip without a false "lifted".
  const wasLockedRef = useRef(false);
  const lastLockInstantRef = useRef<number | null>(null);
  useEffect(() => {
    if (isLocked && !wasLockedRef.current) {
      setSrStatus(
        isDeviceLock
          ? "Too many attempts. This till is locked for 2 minutes"
          : `Too many attempts. ${selectedUser?.displayName} is locked for 2 minutes. Another user can still unlock this till`,
      );
    } else if (!isLocked && wasLockedRef.current) {
      const instant = lastLockInstantRef.current;
      setSrStatus(
        instant !== null && Date.now() >= instant ? "The lock has lifted. Try your PIN again" : "",
      );
    }
    wasLockedRef.current = isLocked;
    if (isLocked) lastLockInstantRef.current = lockedUntil;
  }, [isLocked, isDeviceLock, selectedUser?.displayName, lockedUntil]);

  const setPinDigits = (next: string) => {
    if (isLocked) return;
    setPin(next.replace(/\D/g, "").slice(0, 6));
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
                <p role="status" className="sr-only">
                  {srStatus}
                </p>

                <Input
                  ref={pinInputRef}
                  type="password"
                  inputMode="none"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="PIN"
                  readOnly={isLocked}
                  className="text-center text-2xl tracking-widest"
                  value={pin}
                  onChange={(event) => setPinDigits(event.target.value)}
                />

                {selectedUser && selectedUser.pinHash === null && (
                  <p role="alert">
                    {selectedUser.displayName} has no PIN yet. They set one in the back office, from
                    their account menu
                  </p>
                )}
                {error && !isLocked && <p role="alert">{error}</p>}

                <div className="grid grid-cols-3 gap-2">
                  {KEYPAD_DIGITS.map((digit) => (
                    <Button
                      key={digit}
                      type="button"
                      variant="outline"
                      aria-disabled={isLocked}
                      onClick={() => setPinDigits(pin + digit)}
                    >
                      {digit}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Backspace"
                    aria-disabled={pin.length === 0 || isLocked}
                    onClick={() => {
                      if (pin.length === 0 || isLocked) return;
                      setPinDigits(pin.slice(0, -1));
                    }}
                  >
                    <span aria-hidden="true">⌫</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    aria-disabled={isLocked}
                    onClick={() => setPinDigits(pin + "0")}
                  >
                    0
                  </Button>
                  <Button type="submit" aria-disabled={!canUnlock || pending}>
                    {pending ? "Unlocking…" : "Unlock"}
                  </Button>
                </div>

                {isLocked && lockedUntil !== null && (
                  <p className="w-full rounded-xl border border-dashed border-destructive/60 px-4 py-3 text-center text-sm text-destructive">
                    {isDeviceLock
                      ? `Too many attempts — locked for ${formatClock(lockedUntil - Date.now())}`
                      : `Too many attempts — ${selectedUser?.displayName} locked for ${formatClock(lockedUntil - Date.now())}`}
                  </p>
                )}
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
