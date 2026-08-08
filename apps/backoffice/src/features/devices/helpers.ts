import { useEffect, useRef } from "react";

// Mirrors `deviceOutputSchema` in packages/contract/src/contract.ts — not
// inferred from zod, same reasoning as stores/helpers.ts.
export type DeviceOutput = {
  id: string;
  tenantId: string;
  storeId: string;
  name: string;
  code: string;
  enrolledAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  assignedUserId: string | null;
};

export type DeviceListSortKey = "name" | "store" | "assignedTo" | "lastSeen" | "status";

export type DeviceListSort = { key: DeviceListSortKey; direction: "asc" | "desc" };

// Mirrors `deviceListOutputSchema` — the server-side fleet page (record 056
// Q5): items already filtered/sorted/paged, the headline's fleet totals, and
// the pagination envelope.
export type DeviceListOutput = {
  items: DeviceOutput[];
  count: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  totalCount: number;
  activeCount: number;
};

// The one page size the server and every client call agree on.
export const DEVICES_PAGE_SIZE = 10;

// Mirrors `deviceGenerateCodeOutputSchema`'s success branch, and
// `devicePendingCodeSchema` for one still waiting on its terminal.
export type EnrolmentCode = {
  secret: string;
  name: string;
  code: string;
  storeId: string;
  expiresAt: Date;
};

export type PendingCode = EnrolmentCode & { id: string };

// The assignment picker's own shape — enough of `userOutputSchema` to name a
// User. Eligibility is filtered before a value narrows to this.
export type AssignableUser = {
  id: string;
  firstName: string;
  lastName: string;
};

// Relative text, computed once at render — never an interval (record 056 Q5).
export const relativeLastSeen = (lastSeenAt: Date, now: Date = new Date()): string => {
  const seconds = Math.max(0, Math.round((now.getTime() - lastSeenAt.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

export type DeviceHealth = "green" | "amber" | "grey";

// Fleet health dot colour: green under five minutes since last seen, amber
// under an hour, grey after — or outright grey for a revoked Device, whose
// last seen is history, not health (record 056 Q5).
export const deviceHealthColor = (
  lastSeenAt: Date,
  now: Date = new Date(),
  revoked: boolean,
): DeviceHealth => {
  if (revoked) return "grey";
  const minutes = (now.getTime() - lastSeenAt.getTime()) / 60_000;
  if (minutes < 5) return "green";
  if (minutes < 60) return "amber";
  return "grey";
};

// The last non-null value a Sheet/Dialog was given. The parent nulls its data
// the moment it closes, but Radix keeps the dialog mounted for the exit
// animation — this keeps content on screen instead of a blank flash.
export function useLastNonNull<T>(value: T | null | undefined): T | null {
  const last = useRef<T | null>(null);
  useEffect(() => {
    if (value != null) last.current = value;
  }, [value]);
  return value ?? last.current;
}
