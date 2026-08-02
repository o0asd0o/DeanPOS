import { oc } from "@orpc/contract";
import { passwordSchema, signInPasswordSchema } from "schemas/src/password.ts";
import { z } from "zod";

export const pingOutputSchema = z.object({
  id: z.number().int(),
  message: z.string(),
  createdAt: z.date(),
});

export const storeOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  active: z.boolean(),
  createdAt: z.date(),
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

// What `_shell`'s `beforeLoad` guard reads (record 030) — never the raw
// cookie, which is httpOnly and unreadable from the client on purpose.
export const meOutputSchema = z.discriminatedUnion("authenticated", [
  z.object({ authenticated: z.literal(false) }),
  z.object({ authenticated: z.literal(true), mustChangePassword: z.boolean() }),
]);

// The only place a procedure's shape is declared. PRD "Contract".
export const contract = {
  ping: oc.input(z.void()).output(pingOutputSchema),
  // The wrong-tenant probe helper's demonstration procedure (issue 01,
  // tenant-isolation-spine): addressing another Tenant's Store id must read
  // as not-found, never that Tenant's row.
  store: {
    get: oc.input(z.object({ id: z.string() })).output(storeOutputSchema.nullable()),
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
