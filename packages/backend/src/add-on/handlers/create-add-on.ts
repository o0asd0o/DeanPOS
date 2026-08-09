import { randomUUID } from "node:crypto";
import { catalogAddOnCreateInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { deltaToStored, validateDeltaConfig } from "../../modifier/delta.ts";
import { insertAddOn } from "../db-operations/commands/insert-add-on.command.ts";
import { findActiveAddOnByName } from "../db-operations/queries/find-active-add-on-by-name.query.ts";
import { getAddOn } from "../db-operations/queries/get-add-on.query.ts";
import { nextAddOnSortOrder } from "../db-operations/queries/next-add-on-sort-order.query.ts";
import { toAddOnOutput } from "../helpers.ts";

export const inputSchema = catalogAddOnCreateInputSchema;
type Input = z.infer<typeof inputSchema>;
type Output = ReturnType<typeof toAddOnOutput>;

export const handler: Handler<Input, Output | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return null;
  const deltaResult = validateDeltaConfig(input.delta);
  if (!deltaResult.ok || input.maximum === 0) return null;
  const stored = deltaToStored(deltaResult.delta);
  try {
    const row = await withTenantScope(ctx.db, tenantId, async (db) => {
      const existing = await findActiveAddOnByName(db, input.name);
      if (existing) return getAddOn(db, existing.id);
      const inserted = await insertAddOn(db, {
        id: randomUUID(),
        tenantId,
        name: input.name,
        deltaKind: stored.kind,
        deltaValue: stored.value,
        maximum: input.maximum ?? null,
        sortOrder: await nextAddOnSortOrder(db),
      });
      return getAddOn(db, inserted.id);
    });
    return row ? toAddOnOutput(row, row.linked_to_count) : null;
  } catch {
    return null;
  }
};
