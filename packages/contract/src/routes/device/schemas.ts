import { z } from "zod";

export const deviceOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  storeId: z.string(),
  name: z.string(),
  code: z.string(),
  enrolledAt: z.date(),
  lastSeenAt: z.date(),
  revokedAt: z.date().nullable(),
  assignedUserId: z.string().nullable(),
});

export const deviceListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(10),
  health: z.enum(["all", "online", "stale", "offline"]).default("all"),
  storeId: z.string().optional(),
  search: z.string().max(100).optional(),
  sort: z
    .object({
      key: z.enum(["name", "store", "assignedTo", "lastSeen", "status"]),
      direction: z.enum(["asc", "desc"]),
    })
    .default({ key: "name", direction: "asc" }),
});

export const deviceListOutputSchema = z.object({
  items: z.array(deviceOutputSchema),
  count: z.number(),
  page: z.number(),
  perPage: z.number(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
  totalCount: z.number(),
  activeCount: z.number(),
});

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

export const devicePendingCodeSchema = z.object({
  id: z.string(),
  secret: z.string(),
  name: z.string(),
  code: z.string(),
  storeId: z.string(),
  expiresAt: z.date(),
});

export const deviceRenameInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
});

export const deviceIdInputSchema = z.object({ id: z.string() });

export const deviceSetAssignedUserInputSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
});

export const deviceUpdateInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  assignedUserId: z.string().nullable(),
});
