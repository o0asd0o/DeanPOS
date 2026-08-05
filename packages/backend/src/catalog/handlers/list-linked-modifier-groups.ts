import { catalogListLinkedModifierGroupsInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { toModifierGroupOutput } from "../../modifier-group/helpers.ts";
import { listModifiersForGroup } from "../../modifier/db-operations/queries/list-modifiers-for-group.query.ts";
import { listLinkedModifierGroupsForVariant } from "../db-operations/queries/list-linked-modifier-groups.query.ts";

export const inputSchema = catalogListLinkedModifierGroupsInputSchema;
type Input = z.infer<typeof inputSchema>;

export const handler: Handler<Input, ReturnType<typeof toModifierGroupOutput>[]> = async ({
  ctx,
  input,
}) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return [];
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "manager")) return [];

  return withTenantScope(ctx.db, tenantId, async (db) => {
    const groups = await listLinkedModifierGroupsForVariant(db, input.variantId);
    return Promise.all(
      groups.map(async (group) => {
        const modifiers = await listModifiersForGroup(db, group.id);
        return toModifierGroupOutput(group, modifiers, group.linked_to_count);
      }),
    );
  });
};
