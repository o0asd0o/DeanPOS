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

const postgresIntegerSchema = z.number().int().min(0).max(2_147_483_647);
const orderIdSchema = z.string().uuid();

export const submitOrderOptionSnapshotSchema = z.object({
  id: orderIdSchema,
  name: z.string().trim().min(1).max(60),
  deltaKind: z.enum(["absolute", "multiplier"]),
  deltaValue: z.number().int().min(-100_000).max(100_000),
});

export const submitOrderLineSchema = z.object({
  menuItemId: orderIdSchema,
  menuItemName: z.string().trim().min(1).max(60),
  variantId: orderIdSchema.nullable(),
  variantName: z.string().trim().max(60),
  unitPriceCentavos: postgresIntegerSchema,
  quantity: z.number().int().min(1).max(10_000),
  lineTotalCentavos: postgresIntegerSchema,
  modifiers: z.array(submitOrderOptionSnapshotSchema).max(100),
  addOns: z.array(submitOrderOptionSnapshotSchema).max(100),
});

export const submitOrderInputSchema = z.object({
  id: orderIdSchema,
  lines: z.array(submitOrderLineSchema).min(1).max(1_000),
  totalCentavos: postgresIntegerSchema,
  amountTenderedCentavos: postgresIntegerSchema,
});

export const submitOrderOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    orderId: orderIdSchema,
    changeCentavos: postgresIntegerSchema,
  }),
  z.object({ ok: z.literal(false) }),
]);
