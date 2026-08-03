import { oc } from "@orpc/contract";
import { passwordSchema, signInPasswordSchema } from "schemas/src/password.ts";
import { z } from "zod";

export const pingOutputSchema = z.object({
  id: z.number().int(),
  message: z.string(),
  createdAt: z.date(),
});

// cashier < manager < admin (PRD "Authorisation model"); the one place the
// three role strings are declared as a schema.
export const roleSchema = z.enum(["cashier", "manager", "admin"]);

// `HH:mm`, 24-hour, 00:00-23:59 (record 040 §2; finding 6: enforced here,
// not just accepted as any non-empty string, and backed by a DB check
// constraint since the schema alone is not the authority).
const businessDayStartSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:mm, 00:00-23:59");

export const storeOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  businessDayStart: businessDayStartSchema,
  // Ordered; duplicates permitted (issue 05, ADR-0011).
  tableLabels: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.date(),
});

// Shared by store.create and store.update — the editor always saves name,
// business-day start and the whole label array together (record 040 §3).
export const storeFieldsInputSchema = z.object({
  name: z.string().min(1),
  businessDayStart: businessDayStartSchema,
  tableLabels: z.array(z.string()),
});

export const storeCreateInputSchema = storeFieldsInputSchema;
export const storeUpdateInputSchema = storeFieldsInputSchema.extend({ id: z.string() });
export const storeIdInputSchema = z.object({ id: z.string() });

export const userOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string(),
  role: roleSchema,
  active: z.boolean(),
  createdAt: z.date(),
  // Projected through the caller's own Store visibility, server-side
  // (record 044 §2 clause 3) — never the User's whole assignment set.
  storeIds: z.array(z.string()),
});

// Email is create-only and never editable (record 045 §1 clause 1; record
// 031's global-uniqueness precondition on `user_login_lookup`).
export const userCreateInputSchema = z.object({
  email: z.string().email(),
  role: roleSchema,
  password: passwordSchema,
  storeIds: z.array(z.string()),
});

// Role and the whole Store-assignment set move together — the only shape in
// which "what changed" is unambiguous (record 045 §4). Never `active` or the
// password — those are their own procedures.
export const userUpdateInputSchema = z.object({
  id: z.string(),
  role: roleSchema,
  storeIds: z.array(z.string()),
});

export const userIdInputSchema = z.object({ id: z.string() });

export const userResetPasswordInputSchema = z.object({
  id: z.string(),
  password: passwordSchema,
});

export const provisionTenantInputSchema = z.object({
  tenantName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: passwordSchema,
});

export const provisionTenantOutputSchema = z.object({
  tenantId: z.string(),
  userId: z.string(),
});

export const signInInputSchema = z.object({
  email: z.string().email(),
  // Never the policy schema — sign-in verifies bytes, forever (record 032).
  password: signInPasswordSchema,
});

// The session id never appears here — it leaves the server only as a
// Set-Cookie header (issue 03 acceptance criterion "nothing logs a
// password or a session id").
export const signInOutputSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), mustChangePassword: z.boolean() }),
  z.object({ ok: z.literal(false) }),
]);

export const setPasswordInputSchema = z.object({ newPassword: passwordSchema });
export const setPasswordOutputSchema = z.object({ ok: z.boolean() });

export const signOutOutputSchema = z.object({ ok: z.literal(true) });

// What `_shell`'s `beforeLoad` guard reads (record 030). `role` (038 §6)
// and optional `userId` (044 §4 clause 2) feed the Stores/Users screens.
export const meOutputSchema = z.discriminatedUnion("authenticated", [
  z.object({ authenticated: z.literal(false) }),
  z.object({
    authenticated: z.literal(true),
    mustChangePassword: z.boolean(),
    role: roleSchema,
    userId: z.string().optional(),
    email: z.string().optional(),
  }),
]);

// The only place a procedure's shape is declared. PRD "Contract".
export const contract = {
  ping: oc.input(z.void()).output(pingOutputSchema),
  // The wrong-tenant probe helper's demonstration procedure (issue 01,
  // tenant-isolation-spine): addressing another Tenant's Store id must read
  // as not-found, never that Tenant's row.
  store: {
    get: oc.input(storeIdInputSchema).output(storeOutputSchema.nullable()),
    // Never discloses a Store the caller may not see — no count, no total
    // (record 038 §6). Refused entirely for `cashier`.
    list: oc.input(z.void()).output(z.array(storeOutputSchema)),
    // `admin` only (issue 05 acceptance criteria).
    create: oc.input(storeCreateInputSchema).output(storeOutputSchema.nullable()),
    update: oc.input(storeUpdateInputSchema).output(storeOutputSchema.nullable()),
    // Deliberately not the same procedure as `update` — a save can never
    // accidentally flip active state (record 038 §4, record 040 §3).
    deactivate: oc.input(storeIdInputSchema).output(storeOutputSchema.nullable()),
    reactivate: oc.input(storeIdInputSchema).output(storeOutputSchema.nullable()),
  },
  // Back-office User management (issue 06, record 044 §2). Deactivate/
  // reactivate/resetPassword stay out of `update` (records 040 §3, 043).
  user: {
    list: oc.input(z.void()).output(z.array(userOutputSchema)),
    create: oc.input(userCreateInputSchema).output(userOutputSchema.nullable()),
    update: oc.input(userUpdateInputSchema).output(userOutputSchema.nullable()),
    deactivate: oc.input(userIdInputSchema).output(userOutputSchema.nullable()),
    reactivate: oc.input(userIdInputSchema).output(userOutputSchema.nullable()),
    resetPassword: oc.input(userResetPasswordInputSchema).output(userOutputSchema.nullable()),
  },
  // Platform-admin only (issue 02) — `null` for any tenant-scoped or
  // unauthenticated caller, the same not-found shape store.get uses.
  platformAdmin: {
    provisionTenant: oc
      .input(provisionTenantInputSchema)
      .output(provisionTenantOutputSchema.nullable()),
  },
  // Back-office sign-in and session (issue 03). Cookie-authenticated; every
  // one of these requires an exact `Origin: https://admin.<domain>` match.
  auth: {
    signIn: oc.input(signInInputSchema).output(signInOutputSchema),
    signOut: oc.input(z.void()).output(signOutOutputSchema),
    setPassword: oc.input(setPasswordInputSchema).output(setPasswordOutputSchema),
    me: oc.input(z.void()).output(meOutputSchema),
  },
};
