import { z } from "zod";
import { overrideActionTypeSchema } from "../override/schemas.ts";

export const terminalEnrolInputSchema = z.object({ secret: z.string().min(1) });

export const terminalEnrolOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
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

export const pinRosterUserSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  pinHash: z.string().nullable(),
  canApproveOverride: z.boolean(),
});

export const terminalPinSyncOutputSchema = z
  .object({
    storeId: z.string(),
    syncedAt: z.string(),
    users: z.array(pinRosterUserSchema),
    assignedUserId: z.string().nullable(),
    assignedUserStatus: z.enum(["deactivated", "unassigned"]).nullable(),
  })
  .nullable();

export const recordOverrideInputSchema = z.object({
  approverUserId: z.string(),
  actionType: overrideActionTypeSchema,
  reason: z.string().trim().min(1).max(200),
  note: z.string().trim().min(1).max(500).optional(),
  approvedAt: z.date(),
});

export const recordOverrideOutputSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), overrideId: z.string() }),
  z.object({ ok: z.literal(false) }),
]);
