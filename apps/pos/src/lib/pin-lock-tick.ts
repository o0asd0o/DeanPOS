import { useEffect, useState } from "react";

// The whole lift mechanism: one interval, keyed on the lock instant, running
// only while locked, cleared on unmount and on lift. Lives in the caller
// (which computes `lockedUntil` fresh from readPinThrottle() every render),
// not in PinPad itself — PinPad is presentational, and only the caller's own
// re-render can pick up a lock that has just expired. Shared by Unlock and
// OverridePrompt, so it lives at the app level rather than inside either
// feature folder (code standards rule 3).
export function usePinLockTick(lockedUntil: number | null): void {
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (lockedUntil === null) return;
    const id = setInterval(() => forceTick((tick) => tick + 1), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);
}
