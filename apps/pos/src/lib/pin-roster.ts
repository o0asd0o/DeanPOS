// The hash-sync roster (issue 10, record 057 Q3). Replaced whole, never
// merged — a successful `terminal.pinSync` pull overwrites this atomically,
// so deactivating/reactivating a User just works on next sync.
const ROSTER_KEY = "deanpos.pin.roster";

export type PinRosterUser = {
  userId: string;
  displayName: string;
  pinHash: string | null;
  canApproveOverride: boolean;
};
export type PinRoster = {
  storeId: string;
  syncedAt: string;
  users: PinRosterUser[];
  // Issue 17: null is open-to-all.
  assignedUserId: string | null;
  assignedUserStatus: "deactivated" | "unassigned" | null;
};

// A cached roster written before `canApproveOverride` existed reads
// `undefined` for it — `?? false`, fail closed, so a terminal on a
// pre-upgrade cache offers nobody until it syncs once (record 060 Q1). Same
// reasoning for `assignedUserId`: a pre-issue-17 cache reads `undefined` and
// falls back to `null` — open-to-all, never a restriction it never synced.
export const readPinRoster = (): PinRoster | null => {
  const raw = localStorage.getItem(ROSTER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PinRoster;
    return {
      ...parsed,
      assignedUserId: parsed.assignedUserId ?? null,
      assignedUserStatus: parsed.assignedUserStatus ?? null,
      users: parsed.users.map((user) => ({
        ...user,
        canApproveOverride: user.canApproveOverride ?? false,
      })),
    };
  } catch {
    return null;
  }
};

export const writePinRoster = (roster: PinRoster): void => {
  localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
};

export const clearPinRoster = (): void => localStorage.removeItem(ROSTER_KEY);
