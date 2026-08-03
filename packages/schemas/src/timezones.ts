import { z } from "zod";

// A short, curated list, Philippines-first (record 046 §"Three smaller
// calls"). A picker dependency was refused for the same reason records 042
// and 008 refused one elsewhere. This is the one place the list is declared
// — the client `Select` and the server validator both import it, so a direct
// API call can never put a zone into `reporting` that the client never
// offered.
export const TENANT_TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "UTC",
] as const;

export type TenantTimezone = (typeof TENANT_TIMEZONES)[number];

export const timezoneSchema = z.enum(TENANT_TIMEZONES);
