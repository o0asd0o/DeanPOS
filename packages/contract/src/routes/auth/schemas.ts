import { passwordSchema, signInPasswordSchema } from "schemas/src/password.ts";
import { z } from "zod";
import { roleSchema } from "../user/schemas.ts";

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

// .scratch/decisions/065: both fields required, refused at the boundary.
// currentPassword uses signInPasswordSchema, not 065's passwordSchema —
// a pre-policy password must stay submittable; see the record.
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
