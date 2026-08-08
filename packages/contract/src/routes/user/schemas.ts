import { temporaryPasswordSchema } from "schemas/src/password.ts";
import { z } from "zod";

// cashier < manager < admin (PRD "Authorisation model"); the one place the
// three role strings are declared as a schema.
export const roleSchema = z.enum(["cashier", "manager", "admin"]);

export const userOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: roleSchema,
  active: z.boolean(),
  createdAt: z.date(),
  // Projected through the caller's own Store visibility, server-side
  // (record 044 §2 clause 3) — never the User's whole assignment set.
  storeIds: z.array(z.string()),
});

// The roster's server-side page (record 076 amends 044 §2): role, store and
// search filter in the DB, so a page is a page of the *filtered* set, and the
// count rides the response. `perPage`'s ceiling is 1000, not 100 as on
// device.list, because the Devices assignee picker reads the whole roster
// through this procedure — the screen itself pages at 10.
export const userListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(1000).default(10),
  role: z.enum(["all", "cashier", "manager", "admin"]).default("all"),
  storeId: z.string().optional(),
  search: z.string().max(100).optional(),
  sort: z
    .object({
      key: z.enum(["name", "email", "role", "status"]),
      direction: z.enum(["asc", "desc"]),
    })
    .default({ key: "name", direction: "asc" }),
});

// Amends record 044 §2's "no count, total": every disclosed number counts
// only rows the caller can see (a manager's counts cover their own Stores), so
// the leak the clause feared cannot occur. 044's other two clauses — the
// caller is always in their own result, and the Stores cell is projected
// through the caller's visibility — are unchanged.
export const userListOutputSchema = z.object({
  items: z.array(userOutputSchema),
  count: z.number(),
  page: z.number(),
  perPage: z.number(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
  // The page headline's roster totals, independent of the current filter.
  totalCount: z.number(),
  activeCount: z.number(),
});

// Email is create-only and never editable (record 045 §1 clause 1; record
// 031's global-uniqueness precondition on `user_login_lookup`).
export const userCreateInputSchema = z.object({
  email: z.string().email(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  role: roleSchema,
  password: temporaryPasswordSchema,
  storeIds: z.array(z.string()),
});

// Role and the whole Store-assignment set move together — the only shape in
// which "what changed" is unambiguous (record 045 §4). Never `active` or the
// password — those are their own procedures.
export const userUpdateInputSchema = z.object({
  id: z.string(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  role: roleSchema,
  storeIds: z.array(z.string()),
});

export const userIdInputSchema = z.object({ id: z.string() });

export const userResetPasswordInputSchema = z.object({
  id: z.string(),
  password: temporaryPasswordSchema,
});

// A PIN is a second factor to Device possession, never a credential on its
// own (issue 10) — 4-6 digits, never parsed to a number, no policy from
// record 032. Never returned in any output.
export const pinSchema = z.string().regex(/^\d{4,6}$/, "4 to 6 digits");

// Self-service, cookie/tenant session (issue 10, record 058) — one field,
// covering first use and change alike. No procedure ever verifies a
// submitted PIN, so there is no `currentPin`; no response carries the hash.
export const userSetPinInputSchema = z.object({ pin: pinSchema });
export const userSetPinOutputSchema = z.object({ ok: z.boolean() });

// Admin-only (issue 10, record 057 "smaller calls" 4): clears the hash to
// NULL rather than minting a temporary PIN — the User sets their own on
// next use. `{ ok: true }` only, never a PIN.
export const userResetPinOutputSchema = z.object({ ok: z.boolean() });
