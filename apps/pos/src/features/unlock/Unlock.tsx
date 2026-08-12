import { useEffect, useRef, useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  useSubmitGate,
} from "ui";

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
import { ManagerUnlockDialog } from "./ManagerUnlockDialog.tsx";
import { usePinRoster } from "./__common/queries.ts";

// No real userId is ever "" — used to read only the Device half of the lock
// (record 059 Q1's two counters) without a User selected.
const DEVICE_ONLY_KEY = "";

const ASSIGNED_USER_STATUS_MESSAGE: Record<"deactivated" | "unassigned", string> = {
  deactivated: "has been deactivated",
  unassigned: "is no longer assigned to this store",
};

// The unlock screen (issue 10, record 057 Q4; restricted state issue 17).
// Verified locally against the last synced roster (usePinRoster) — there is
// no online unlock path. Locking (record 059) is on-device only.
export function Unlock() {
  const roster = usePinRoster();
  const identity = readDeviceIdentity();
  const { setActingUser } = useActingUser();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<"accounts" | "pin">("accounts");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [managerUnlockOpen, setManagerUnlockOpen] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // A restricted Device offers no chooser (issue 17) — the assigned User is
  // the only selectable identity, and only when they still qualify for the
  // roster (record 060 Q1's per-Store eligibility, applied server-side).
  const restricted = roster !== null && roster.assignedUserId !== null;
  const assignedUser = restricted
    ? (roster!.users.find((user) => user.userId === roster!.assignedUserId) ?? null)
    : null;
  const selectedUser = restricted
    ? assignedUser
    : (roster?.users.find((user) => user.userId === selectedId) ?? null);
  const approvers = roster?.users.filter((user) => user.canApproveOverride) ?? [];

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

  const form = useForm({
    defaultValues: { pin: "" },
    onSubmit: async ({ value }) => {
      if (isLocked || pending) return;
      if (!selectedUser) {
        setError("Choose who is on the till");
        return;
      }
      // The no-PIN-yet case already stands as its own alert below.
      if (selectedUser.pinHash === null) return;
      if (value.pin.length < 4) {
        setError("Enter your PIN");
        return;
      }

      setPending(true);
      setError(null);
      const ok = await verifyPin(value.pin, selectedUser.pinHash);
      setPending(false);

      if (!ok) {
        recordPinFailure(selectedUser.userId);
        const justLocked = pinLockUntil(readPinThrottle(), selectedUser.userId) !== null;
        form.reset();
        // A lock replaces the error, never joins it — the strip covers it.
        setError(justLocked ? null : "That PIN is not correct");
        return;
      }
      recordPinSuccess(selectedUser.userId);
      setActingUser({ userId: selectedUser.userId, displayName: selectedUser.displayName });
    },
  });
  const pin = useStore(form.store, (state) => state.values.pin);
  // `dirty` opts out of the pristine block: an empty PIN has to reach the
  // submit path, or Unlock could never explain what is missing.
  const gate = useSubmitGate(form, { busy: pending, dirty: true });

  const setPinDigits = (next: string) => {
    form.setFieldValue("pin", next);
    setSrStatus("");
  };

  useEffect(() => {
    if (!restricted && activeStep === "pin" && selectedUser) pinInputRef.current?.focus();
  }, [activeStep, restricted, selectedUser]);

  const handleSelect = (userId: string) => {
    if (isDeviceLock) return;
    setSelectedId(userId);
    form.reset();
    setError(null);
    setActiveStep("pin");
  };

  const handleBackToAccounts = () => {
    form.reset();
    setError(null);
    setActiveStep("accounts");
  };

  // At the PIN step, Unlock stays live so its click can name a missing PIN.
  const unlockBlocked = gate.blocked || isLocked;

  const noOneYet = !roster || (!restricted && roster.users.length === 0);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Unlock this till</CardTitle>
          <CardDescription>
            {identity
              ? `${identity.storeName} · ${identity.name}`
              : "Choose your account, then enter your PIN"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {noOneYet ? (
            <>
              <p role="status">
                No one is set up at this till yet. Connect once to load the store&rsquo;s users
              </p>
              <Button asChild>
                <Link to="/enrol">Register this POS</Link>
              </Button>
            </>
          ) : restricted ? (
            <>
              <p className="text-lg font-medium">
                {assignedUser ? assignedUser.displayName : "This till's assigned employee"}
              </p>

              {assignedUser ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    gate.submit();
                  }}
                  className="flex flex-col gap-4"
                >
                  <PinPad
                    inputRef={pinInputRef}
                    pin={pin}
                    onPinChange={setPinDigits}
                    lockedUntil={lockedUntil}
                    lockMessage={
                      isDeviceLock
                        ? "Too many attempts — locked for"
                        : `Too many attempts — ${assignedUser.displayName} locked for`
                    }
                    srStatus={srStatus}
                    trailing={
                      <Button type="submit" aria-disabled={unlockBlocked}>
                        {pending ? "Unlocking…" : "Unlock"}
                      </Button>
                    }
                  />
                  {assignedUser.pinHash === null && (
                    <p role="alert" className="text-sm text-destructive">
                      {assignedUser.displayName} has no PIN yet. They set one in the back office,
                      from their account menu
                    </p>
                  )}
                  {error && !isLocked && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}
                </form>
              ) : (
                <p role="alert">
                  {roster!.assignedUserStatus &&
                    `This till's assigned employee ${ASSIGNED_USER_STATUS_MESSAGE[roster!.assignedUserStatus]}.`}{" "}
                  Use manager sign-in below.
                </p>
              )}

              <Button type="button" variant="outline" onClick={() => setManagerUnlockOpen(true)}>
                Manager sign-in
              </Button>
              <ManagerUnlockDialog
                open={managerUnlockOpen}
                onOpenChange={setManagerUnlockOpen}
                approvers={approvers}
              />
            </>
          ) : (
            <div>
              {activeStep === "accounts" ? (
                <div className="animate-in slide-in-from-left-4 duration-200">
                  <p className="mb-2 text-sm font-medium">Choose account</p>
                  <div
                    role="group"
                    aria-label="Choose your account"
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
                        className="min-h-14 px-4"
                      >
                        {user.displayName}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="animate-in slide-in-from-right-4 duration-200">
                  {selectedUser && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        gate.submit();
                      }}
                      className="flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">PIN · {selectedUser.displayName}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleBackToAccounts}
                        >
                          <ChevronLeftIcon />
                          Back
                        </Button>
                      </div>
                      <PinPad
                        inputRef={pinInputRef}
                        pin={pin}
                        onPinChange={setPinDigits}
                        lockedUntil={lockedUntil}
                        lockMessage={
                          isDeviceLock
                            ? "Too many attempts — locked for"
                            : `Too many attempts — ${selectedUser.displayName} locked for`
                        }
                        srStatus={srStatus}
                        trailing={
                          <Button type="submit" aria-disabled={unlockBlocked}>
                            {pending ? "Unlocking…" : "Unlock"}
                          </Button>
                        }
                      />

                      {selectedUser.pinHash === null && (
                        <p role="alert" className="text-sm text-destructive">
                          {selectedUser.displayName} has no PIN yet. They set one in the back
                          office, from their account menu
                        </p>
                      )}
                      {error && !isLocked && (
                        <p role="alert" className="text-sm text-destructive">
                          {error}
                        </p>
                      )}
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
