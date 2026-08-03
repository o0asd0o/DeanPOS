import { z } from "zod";

// A short, curated list, Philippines-first (record 046). A picker dependency
// was refused, as records 042 and 008 refused one elsewhere.
export const TENANT_TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "UTC",
] as const;

export type TenantTimezone = (typeof TENANT_TIMEZONES)[number];

export const timezoneSchema = z.enum(TENANT_TIMEZONES);
