// The hash-sync roster (issue 10, record 057 Q3). Replaced whole, never
// merged — a successful `terminal.pinSync` pull overwrites this atomically,
// so deactivating/reactivating a User just works on next sync.
const ROSTER_KEY = "deanpos.pin.roster";

export type PinRosterUser = { userId: string; displayName: string; pinHash: string | null };
export type PinRoster = { storeId: string; syncedAt: string; users: PinRosterUser[] };

export const readPinRoster = (): PinRoster | null => {
  const raw = localStorage.getItem(ROSTER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PinRoster;
  } catch {
    return null;
  }
};

export const writePinRoster = (roster: PinRoster): void => {
  localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
};

export const clearPinRoster = (): void => localStorage.removeItem(ROSTER_KEY);
