import { randomUUID } from "node:crypto";
import { catalogDiscountUpdateInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertDiscount } from "../db-operations/commands/insert-discount.command.ts";
import { insertDiscountAudit } from "../db-operations/commands/insert-discount-audit.command.ts";
import { lockDiscount } from "../db-operations/commands/lock-discount.command.ts";
import { getCurrentDiscount } from "../db-operations/queries/get-current-discount.query.ts";
import { toDiscountOutput } from "../helpers.ts";

export const inputSchema = catalogDiscountUpdateInputSchema;
type Input = z.infer<typeof inputSchema>;
const fields = [
  "name",
  "type",
  "scope",
  "value",
  "requiresOverride",
  "vatExempt",
  "requiresReference",
  "referenceLabel",
] as const;
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
      await lockDiscount(db, `discount-name:${ctx.principal.tenantId}:${input.name.toLowerCase()}`);
      const current = await getCurrentDiscount(db, input.id);
      if (!current || current.archived_at) return null;
      const duplicate = await db
        .selectFrom("Discount")
        .select("id")
        .where("name", "=", input.name)
        .where("archived_at", "is", null)
        .where("discount_id", "!=", input.id)
        .executeTakeFirst();
      if (duplicate) return null;
      const next = {
        ...current,
        name: input.name,
        type: input.type,
        scope: input.scope,
        value: input.value,
        requires_override: input.requiresOverride,
        vat_exempt: input.vatExempt,
        requires_reference: input.requiresReference,
        reference_label: input.referenceLabel?.trim() || null,
      };
      const effectiveFrom = new Date();
      const inserted = await insertDiscount(db, {
        id: randomUUID(),
        discountId: input.id,
        tenantId: ctx.principal.tenantId,
        name: next.name,
        type: next.type,
        scope: next.scope,
        value: next.value,
        requiresOverride: next.requires_override,
        vatExempt: next.vat_exempt,
        requiresReference: next.requires_reference,
        referenceLabel: next.reference_label,
        archivedAt: current.archived_at,
        effectiveFrom,
      });
      for (const field of fields)
        if (
          current[
            field === "requiresOverride"
              ? "requires_override"
              : field === "vatExempt"
                ? "vat_exempt"
                : field === "requiresReference"
                  ? "requires_reference"
                  : field === "referenceLabel"
                    ? "reference_label"
                    : field
          ] !==
          next[
            field === "requiresOverride"
              ? "requires_override"
              : field === "vatExempt"
                ? "vat_exempt"
                : field === "requiresReference"
                  ? "requires_reference"
                  : field === "referenceLabel"
                    ? "reference_label"
                    : field
          ]
        )
          await insertDiscountAudit(db, {
            id: randomUUID(),
            tenantId: ctx.principal.tenantId,
            actorUserId: ctx.principal.userId!,
            discountId: input.id,
            field,
          });
      return inserted;
    });
    return row ? toDiscountOutput(row) : null;
  } catch {
    return null;
  }
};
