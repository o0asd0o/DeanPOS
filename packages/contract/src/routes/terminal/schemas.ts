import { z } from "zod";
import { overrideActionTypeSchema } from "../override/schemas.ts";
import { paymentMethodKindSchema } from "../payment-method/schemas.ts";

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
const deviceSequenceSchema = z.number().int().min(1).max(2_147_483_647);

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
  paymentMethodId: orderIdSchema,
  cashierUserId: orderIdSchema,
  deviceSequence: deviceSequenceSchema,
  orderNumber: z.string().regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ0-9]{2,4}-[0-9]{4,}$/),
  lines: z.array(submitOrderLineSchema).min(1).max(1_000),
  totalCentavos: postgresIntegerSchema,
  amountTenderedCentavos: postgresIntegerSchema,
});

export const receiptLineSchema = z.object({
  menuItemName: z.string(),
  variantName: z.string(),
  unitPriceCentavos: postgresIntegerSchema,
  quantity: z.number().int().min(1),
  lineTotalCentavos: postgresIntegerSchema,
  modifiers: z.array(submitOrderOptionSnapshotSchema),
  addOns: z.array(submitOrderOptionSnapshotSchema),
});

export const receiptSchema = z.object({
  orderId: orderIdSchema,
  orderNumber: z.string(),
  deviceCode: z.string(),
  deviceName: z.string(),
  cashierUserId: orderIdSchema.nullable(),
  cashierName: z.string().nullable(),
  paymentMethodId: orderIdSchema,
  paymentMethodName: z.string(),
  paymentMethodKind: paymentMethodKindSchema,
  totalCentavos: postgresIntegerSchema,
  vatRatePercent: z.number().int().min(0).nullable(),
  amountTenderedCentavos: postgresIntegerSchema,
  changeCentavos: postgresIntegerSchema,
  lines: z.array(receiptLineSchema),
});
export type Receipt = z.infer<typeof receiptSchema>;

export const submitOrderOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    receipt: receiptSchema,
  }),
  z.object({ ok: z.literal(false) }),
]);

export const receiptInputSchema = z.object({ id: orderIdSchema });
export const receiptOutputSchema = receiptSchema.nullable();
