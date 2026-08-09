import { availabilitySetInputSchema } from "contract/src/contract.ts";
import type { z } from "zod";
import { hasAtLeastRole, canAccessStore } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getStore } from "../../store/db-operations/queries/get-store.query.ts";
import { setAvailability } from "../db-operations/commands/set-availability.command.ts";

type Input = z.infer<typeof availabilitySetInputSchema>;
export const handler: Handler<Input, { version: string } | null> = async ({
  ctx,
  input,
}) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role)
    return null;
  if (!hasAtLeastRole(ctx.principal.role, "admin")) return null;
  const { tenantId, userId, role } = ctx.principal;
  return withTenantScope(ctx.db, tenantId, async (db) => {
    if (
      !(await getStore(db, input.storeId)) ||
      !(await canAccessStore(db, userId, role, input.storeId))
    )
      return null;
    const variantsOff = input.changes
      .filter((c) => c.target.kind === "variant" && !c.available)
      .map((c) => c.target.id);
    const variantsOn = input.changes
      .filter((c) => c.target.kind === "variant" && c.available)
      .map((c) => c.target.id);
    const itemsOff = input.changes
      .filter((c) => c.target.kind === "menuItem" && !c.available)
      .map((c) => c.target.id);
    const itemsOn = input.changes
      .filter((c) => c.target.kind === "menuItem" && c.available)
      .map((c) => c.target.id);
    return {
      version: await setAvailability(db, {
        tenantId,
        storeId: input.storeId,
        variantsOff,
        variantsOn,
        itemsOff,
        itemsOn,
      }),
    };
  });
};
