import { randomUUID } from "node:crypto";
import { catalogDiscountCreateInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertDiscount } from "../db-operations/commands/insert-discount.command.ts";
import { insertDiscountAvailability } from "../db-operations/commands/insert-discount-availability.command.ts";
import { insertDiscountAudit } from "../db-operations/commands/insert-discount-audit.command.ts";
import { lockDiscount } from "../db-operations/commands/lock-discount.command.ts";
import { toDiscountOutput } from "../helpers.ts";

export const inputSchema = catalogDiscountCreateInputSchema;
type Input = z.infer<typeof inputSchema>;
export const handler: Handler<Input, ReturnType<typeof toDiscountOutput> | null> = async ({
  ctx,
  input,
}) => {
  if (
    ctx.kind !== "tenant" ||
    !ctx.principal.role ||
    !ctx.principal.userId ||
    !hasAtLeastRole(ctx.principal.role, "manager")
  )
    return null;
  try {
    const row = await withTenantScope(ctx.db, ctx.principal.tenantId, async (db) => {
      await lockDiscount(db, `discount-name:${ctx.principal.tenantId}:${input.name.toLowerCase()}`);
      const duplicate = await db
        .selectFrom("Discount")
        .select("id")
        .where("name", "=", input.name)
        .where("archived_at", "is", null)
        .executeTakeFirst();
      if (duplicate) return null;
      const effectiveFrom = new Date();
      const discountId = randomUUID();
      const inserted = await insertDiscount(db, {
        id: randomUUID(),
        discountId,
        tenantId: ctx.principal.tenantId,
        name: input.name,
        type: input.type,
        scope: input.scope,
        value: input.value,
        requiresOverride: input.requiresOverride,
        vatExempt: input.vatExempt,
        requiresReference: input.requiresReference,
        referenceLabel: input.referenceLabel?.trim() || null,
        archivedAt: null,
        effectiveFrom,
      });
      const storeIds =
        input.storeIds ??
        (await db.selectFrom("Store").select("id").where("active", "=", true).execute()).map(
          (store) => store.id,
        );
      for (const storeId of new Set(storeIds))
        await insertDiscountAvailability(db, {
          id: randomUUID(),
          tenantId: ctx.principal.tenantId,
          discountVersionId: inserted.id,
          storeId,
        });
      await insertDiscountAudit(db, {
        id: randomUUID(),
        tenantId: ctx.principal.tenantId,
        actorUserId: ctx.principal.userId!,
        discountId,
        field: "created",
      });
      return { inserted, storeIds: [...new Set(storeIds)] };
    });
    return row ? toDiscountOutput(row.inserted, row.storeIds) : null;
  } catch {
    return null;
  }
};
