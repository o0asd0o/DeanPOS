import { useEffect, useRef, useState } from "react";

// One interval, keyed on the lock instant, running only while locked. Lives
// in the caller (which recomputes `lockedUntil` fresh each render) rather
// than in PinPad, since only the caller's re-render can pick up a lift.
export function usePinLockTick(lockedUntil: number | null): void {
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (lockedUntil === null) return;
    const id = setInterval(() => forceTick((tick) => tick + 1), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);
}

// Announces exactly on lock engage and on real (time-based) lift. Shared by
// Unlock and OverridePrompt so the two surfaces cannot drift.
export function usePinLockAnnouncement(
  isLocked: boolean,
  isDeviceLock: boolean,
  lockedUntil: number | null,
  lockedDisplayName: string | undefined,
): [string, (status: string) => void] {
  const [srStatus, setSrStatus] = useState("");
  const wasLockedRef = useRef(false);
  const lastLockInstantRef = useRef<number | null>(null);

  useEffect(() => {
    if (isLocked && !wasLockedRef.current) {
      setSrStatus(
        isDeviceLock
          ? "Too many attempts. This till is locked for 2 minutes"
          : `Too many attempts. ${lockedDisplayName} is locked for 2 minutes. Another user can still unlock this till`,
      );
    } else if (!isLocked && wasLockedRef.current) {
      const instant = lastLockInstantRef.current;
      setSrStatus(
        instant !== null && Date.now() >= instant ? "The lock has lifted. Try your PIN again" : "",
      );
    }
    wasLockedRef.current = isLocked;
    if (isLocked) lastLockInstantRef.current = lockedUntil;
  }, [isLocked, isDeviceLock, lockedDisplayName, lockedUntil]);

  return [srStatus, setSrStatus];
}
