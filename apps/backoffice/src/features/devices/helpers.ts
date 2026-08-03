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
};

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
