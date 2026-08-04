import { oc } from "@orpc/contract";
import {
  passwordSchema,
  signInPasswordSchema,
  temporaryPasswordSchema,
} from "schemas/src/password.ts";
import { timezoneSchema } from "schemas/src/timezones.ts";
import { z } from "zod";

export const pingOutputSchema = z.object({
  id: z.number().int(),
  message: z.string(),
  createdAt: z.date(),
});

// cashier < manager < admin (PRD "Authorisation model"); the one place the
// three role strings are declared as a schema.
export const roleSchema = z.enum(["cashier", "manager", "admin"]);

// `HH:mm`, 24-hour, 00:00-23:59 (record 040 §2): enforced here, not just
// accepted as any non-empty string, and backed by a DB check constraint
// since the schema alone is not the authority.
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
  firstName: z.string(),
  lastName: z.string(),
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

// Issue 07, record 046 §2: these five columns, integer centavos (ADR-0005),
// integer VAT percent (record 046 §1). A setting governs sales made from now
// on — nothing here reads a current value to interpret a past one.
export const tenantSettingsOutputSchema = z.object({
  timezone: timezoneSchema,
  vatEnabled: z.boolean(),
  vatRatePercent: z.number().int(),
  varianceToleranceCentavos: z.number().int(),
  cashMovementOverrideThresholdCentavos: z.number().int(),
});

export const tenantSettingsUpdateInputSchema = z.object({
  timezone: timezoneSchema,
  vatEnabled: z.boolean(),
  vatRatePercent: z.number().int().min(0),
  varianceToleranceCentavos: z.number().int().min(0),
  cashMovementOverrideThresholdCentavos: z.number().int().min(0),
});

// `kind` is the only thing anything downstream may branch on — never `name`
// (issue 08 acceptance criteria). Presets (Card, GCash, Maya, Bank transfer)
// are seed suggestions on the Name field's `<datalist>`, not an enum.
export const paymentMethodKindSchema = z.enum(["cash", "recorded"]);

export const paymentMethodOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  kind: paymentMethodKindSchema,
  active: z.boolean(),
  createdAt: z.date(),
  // Empty for `cash`, which is available everywhere unconditionally and
  // holds no join rows (record 054 §"Smaller calls" 3).
  storeIds: z.array(z.string()),
});

// Each independently optional; a method with none set behaves byte-for-byte
// as it does today (issue 14, record 066 Q5). `image` is tri-state: absent
// leaves the bytes untouched, `null` clears them, an object replaces them.
export const paymentMethodPaymentDetailsInputSchema = z.object({
  accountName: z.string().trim().min(1).nullable(),
  accountNumber: z.string().trim().min(1).nullable(),
  image: z
    .object({ base64: z.string().min(1) })
    .nullable()
    .optional(),
});

// Every created method is `recorded` — there is no `kind` control (record 054
// Q3). Availability defaults to every Store checked (record 054 §"Smaller
// calls" 4); the caller decides which to uncheck.
export const paymentMethodCreateInputSchema = z.object({
  name: z.string().min(1),
  storeIds: z.array(z.string()),
  paymentDetails: paymentMethodPaymentDetailsInputSchema.optional(),
});

// Name, the whole availability set, and the payment-detail fields all move
// together — one form, one Save, one transaction (record 054 Q3, extended by
// record 066 Q7). Never `active`; that is its own procedure.
export const paymentMethodUpdateInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  storeIds: z.array(z.string()),
  paymentDetails: paymentMethodPaymentDetailsInputSchema.optional(),
});

export const paymentMethodIdInputSchema = z.object({ id: z.string() });

// The Tenant-default row for a method, admin-only (issue 14). `image` carries
// a data URL for the editor's preview and the hash triple the audit stores —
// never a separate endpoint that could commit outside the one Save.
export const paymentMethodPaymentDetailsOutputSchema = z.object({
  accountName: z.string().nullable(),
  accountNumber: z.string().nullable(),
  image: z
    .object({
      dataUrl: z.string(),
      mime: z.string(),
      sha256: z.string(),
      byteLength: z.number(),
    })
    .nullable(),
});

// Device management (issue 09, record 056). `admin`-only.
export const deviceOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  storeId: z.string(),
  name: z.string(),
  code: z.string(),
  enrolledAt: z.date(),
  lastSeenAt: z.date(),
  revokedAt: z.date().nullable(),
});

// The Device short code, admin-typed (record 056 Q4): 2-4 symbols from a
// 33-symbol set that excludes I/L/O.
const deviceCodeSchema = z
  .string()
  .regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ0-9]{2,4}$/i, "2-4 characters, letters and digits, no I/L/O");

export const deviceGenerateCodeInputSchema = z.object({
  storeId: z.string(),
  name: z.string().min(1),
  code: deviceCodeSchema,
});

export const deviceGenerateCodeOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    secret: z.string(),
    name: z.string(),
    code: z.string(),
    storeId: z.string(),
    expiresAt: z.date(),
  }),
  z.object({ ok: z.literal(false) }),
]);

// An enrolment code still waiting for its terminal — `admin`-only, and the
// secret is readable so the back office can show the same code again.
export const devicePendingCodeSchema = z.object({
  id: z.string(),
  secret: z.string(),
  name: z.string(),
  code: z.string(),
  storeId: z.string(),
  expiresAt: z.date(),
});

export const deviceRenameInputSchema = z.object({ id: z.string(), name: z.string().min(1) });
export const deviceIdInputSchema = z.object({ id: z.string() });

// The terminal's own procedures (issue 09, record 056 Q6). `enrol` is
// unauthenticated; `me`/`heartbeat` are Device-token.
export const terminalEnrolInputSchema = z.object({ secret: z.string().min(1) });

export const terminalEnrolOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    // The one place the plaintext token ever appears (record 056 Q2).
    token: z.string(),
    deviceId: z.string(),
    name: z.string(),
    code: z.string(),
    storeId: z.string(),
    storeName: z.string(),
  }),
  z.object({ ok: z.literal(false) }),
]);

export const terminalMeOutputSchema = z.discriminatedUnion("authenticated", [
  z.object({ authenticated: z.literal(false) }),
  z.object({
    authenticated: z.literal(true),
    deviceId: z.string(),
    name: z.string(),
    code: z.string(),
    storeId: z.string(),
    storeName: z.string(),
  }),
]);

export const terminalHeartbeatOutputSchema = z.object({ ok: z.boolean() });

// The hash-sync payload (issue 10, record 057 Q3). No input at all — a
// wrong-Store request has no field to ask with, so the refusal is
// structural. No email, no role, no passwordHash, ever.
export const pinRosterUserSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  pinHash: z.string().nullable(),
  // Issue 12, record 060 Q1: one boolean, not a role — membership is already
  // applied when the list is built, so every eligible entry is by
  // construction someone who may approve at this Device.
  canApproveOverride: z.boolean(),
});

// Refusal is `null`, the same not-found shape store.get uses — the root
// key set of a successful payload is exactly these three (record 057 Q3).
export const terminalPinSyncOutputSchema = z
  .object({
    storeId: z.string(),
    syncedAt: z.string(),
    users: z.array(pinRosterUserSchema),
  })
  .nullable();

// The Override mechanism (issue 12, record 060). ADR-0005's fixed four;
// a fifth is an ADR amendment, not a contract change.
export const overrideActionTypeSchema = z.enum([
  "void_paid_order",
  "refund",
  "line_price_override",
  "drawer_variance",
]);

// Device-token only (record 060 Q1). The approver is chosen by id, never
// identified by a PIN sent to the server — no field here carries one.
export const recordOverrideInputSchema = z.object({
  approverUserId: z.string(),
  actionType: overrideActionTypeSchema,
  reason: z.string().trim().min(1).max(200),
  note: z.string().trim().min(1).max(500).optional(),
  // The terminal's claim (record 060 Q4) — the server bounds it, never
  // trusts it unbounded.
  approvedAt: z.date(),
});

export const recordOverrideOutputSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), overrideId: z.string() }),
  z.object({ ok: z.literal(false) }),
]);

// The back-office review list (criterion 8). No `verified` column — every
// row in Override passed re-verification at the instant it was inserted.
export const overrideOutputSchema = z.object({
  id: z.string(),
  approvedAt: z.date(),
  storeId: z.string(),
  storeName: z.string(),
  actionType: overrideActionTypeSchema,
  approverName: z.string(),
  reason: z.string(),
  note: z.string().nullable(),
  deviceId: z.string(),
  deviceName: z.string(),
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

// Record 065: a second procedure, not a branch — both fields required in
// the schema, refused at the boundary rather than by a runtime flag read.
// `currentPassword` verifies bytes against an existing hash, never the
// policy schema (same reasoning as sign-in's own password field).
export const changePasswordInputSchema = z.object({
  currentPassword: signInPasswordSchema,
  newPassword: passwordSchema,
});
export const changePasswordOutputSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    reason: z.enum(["wrong-current-password", "throttled", "refused"]),
  }),
]);

export const signOutOutputSchema = z.object({ ok: z.literal(true) });

// What `_shell`'s `beforeLoad` guard reads (record 030). `firstName`/
// `lastName`/`stores` feed `/account` (issue 15, record 063 Amendment 1).
export const meOutputSchema = z.discriminatedUnion("authenticated", [
  z.object({ authenticated: z.literal(false) }),
  z.object({
    authenticated: z.literal(true),
    mustChangePassword: z.boolean(),
    role: roleSchema,
    userId: z.string().optional(),
    email: z.string().optional(),
    firstName: z.string(),
    lastName: z.string(),
    stores: z.array(z.object({ id: z.string(), name: z.string() })),
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
    // PIN set/change (self) and reset (admin) — issue 10. Never the same
    // procedure as the password ones; the hash never rides an output.
    setPin: oc.input(userSetPinInputSchema).output(userSetPinOutputSchema),
    resetPin: oc.input(userIdInputSchema).output(userResetPinOutputSchema),
  },
  // Payment methods (issue 08, record 054). `admin`-only; `null` for any
  // non-admin or unauthenticated caller, same shape as store.get.
  paymentMethod: {
    list: oc.input(z.void()).output(z.array(paymentMethodOutputSchema)),
    create: oc.input(paymentMethodCreateInputSchema).output(paymentMethodOutputSchema.nullable()),
    update: oc.input(paymentMethodUpdateInputSchema).output(paymentMethodOutputSchema.nullable()),
    // Deliberately not `update` — a save can never accidentally flip active
    // state (record 040 §3, carried into record 054 Q3).
    deactivate: oc.input(paymentMethodIdInputSchema).output(paymentMethodOutputSchema.nullable()),
    reactivate: oc.input(paymentMethodIdInputSchema).output(paymentMethodOutputSchema.nullable()),
    // The editor's own fetch when it opens for edit (issue 14) — never
    // riding `list`, which keeps `list`'s output shape unchanged.
    getPaymentDetails: oc
      .input(paymentMethodIdInputSchema)
      .output(paymentMethodPaymentDetailsOutputSchema.nullable()),
  },
  // `admin`-only, tenant-wide financial controls (issue 07). `null` for any
  // non-admin or unauthenticated caller — the same not-found shape store.get
  // uses; `manager`/`cashier` never see this screen at all.
  settings: {
    get: oc.input(z.void()).output(tenantSettingsOutputSchema.nullable()),
    update: oc.input(tenantSettingsUpdateInputSchema).output(tenantSettingsOutputSchema.nullable()),
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
    changePassword: oc.input(changePasswordInputSchema).output(changePasswordOutputSchema),
    me: oc.input(z.void()).output(meOutputSchema),
  },
  // Device management (issue 09, record 056 Q6). Cookie/admin — never
  // accepts a Device token, the same not-found/false shape other admin-only
  // procedures use.
  device: {
    list: oc.input(z.void()).output(z.array(deviceOutputSchema)),
    pendingCodes: oc.input(z.void()).output(z.array(devicePendingCodeSchema)),
    cancelCode: oc.input(deviceIdInputSchema).output(z.object({ ok: z.boolean() })),
    generateCode: oc.input(deviceGenerateCodeInputSchema).output(deviceGenerateCodeOutputSchema),
    rename: oc.input(deviceRenameInputSchema).output(deviceOutputSchema.nullable()),
    revoke: oc.input(deviceIdInputSchema).output(deviceOutputSchema.nullable()),
  },
  // The terminal's own key (issue 09, record 056 Q6) — distinct from
  // `device` above so the two principals can never be mixed in one
  // contract entry. `enrol` unauthenticated; `me`/`heartbeat` Device-token.
  terminal: {
    enrol: oc.input(terminalEnrolInputSchema).output(terminalEnrolOutputSchema),
    me: oc.input(z.void()).output(terminalMeOutputSchema),
    heartbeat: oc.input(z.void()).output(terminalHeartbeatOutputSchema),
    // The hash-sync payload (issue 10, record 057 Q3). Pulled, never
    // pushed; no input, so a wrong-Store request has no field to ask with.
    pinSync: oc.input(z.void()).output(terminalPinSyncOutputSchema),
    // Issue 12, record 060 Q1: no server procedure compares a PIN — the
    // Device token plus verifyOverrideAsOf are what's trusted.
    recordOverride: oc.input(recordOverrideInputSchema).output(recordOverrideOutputSchema),
  },
  // The Override review list (issue 12, record 060 Q5). Cookie/admin or
  // manager; `null` for `cashier`, the shipped not-found/refusal shape.
  override: {
    list: oc.input(z.void()).output(z.array(overrideOutputSchema).nullable()),
  },
};
