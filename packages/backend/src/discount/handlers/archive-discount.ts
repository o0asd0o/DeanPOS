import { randomUUID } from "node:crypto";
import { catalogEntityIdInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertDiscount } from "../db-operations/commands/insert-discount.command.ts";
import { insertDiscountAvailability } from "../db-operations/commands/insert-discount-availability.command.ts";
import { insertDiscountAudit } from "../db-operations/commands/insert-discount-audit.command.ts";
import { lockDiscount } from "../db-operations/commands/lock-discount.command.ts";
import { getCurrentDiscount } from "../db-operations/queries/get-current-discount.query.ts";
import { getDiscountAvailabilityStoreIds } from "../db-operations/queries/get-discount-availability-store-ids.query.ts";
import { toDiscountOutput } from "../helpers.ts";
export const inputSchema = catalogEntityIdInputSchema;
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
      await lockDiscount(db, `discount-lineage:${ctx.principal.tenantId}:${input.id}`);
      const current = await getCurrentDiscount(db, input.id);
      if (!current || current.archived_at) return current ?? null;
      const effectiveFrom = new Date();
      const versionId = randomUUID();
      const inserted = await insertDiscount(db, {
        id: versionId,
        discountId: current.discount_id,
        tenantId: current.tenant_id,
        name: current.name,
        type: current.type,
        scope: current.scope,
        value: current.value,
        requiresOverride: current.requires_override,
        vatExempt: current.vat_exempt,
        requiresReference: current.requires_reference,
        referenceLabel: current.reference_label,
        archivedAt: effectiveFrom,
        effectiveFrom,
      });
      const storeIds = await getDiscountAvailabilityStoreIds(db, current.id);
      for (const storeId of storeIds)
        await insertDiscountAvailability(db, {
          id: randomUUID(),
          tenantId: current.tenant_id,
          discountVersionId: versionId,
          storeId,
        });
      await insertDiscountAudit(db, {
        id: randomUUID(),
        tenantId: current.tenant_id,
        actorUserId: ctx.principal.userId!,
        discountId: current.discount_id,
        field: "archived",
      });
      return { inserted, storeIds };
    });
    return row ? toDiscountOutput(row.inserted, row.storeIds) : null;
  } catch {
    return null;
  }
};
