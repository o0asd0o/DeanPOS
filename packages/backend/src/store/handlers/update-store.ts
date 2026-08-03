import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { updateStore } from "../db-operations/commands/update-store.command.ts";
import { toStoreOutput } from "../helpers.ts";

export const inputSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  businessDayStart: z.string().min(1),
  tableLabels: z.array(z.string()),
});

type UpdateStoreInput = z.infer<typeof inputSchema>;
type StoreOutput = ReturnType<typeof toStoreOutput>;

// `admin` only. Never changes `active` — deactivate/reactivate are their
// own procedures (record 040 §3), so a save can never flip active state.
export const handler: Handler<UpdateStoreInput, StoreOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  const store = await withTenantScope(ctx.db, tenantId, (scopedDb) =>
    updateStore(scopedDb, input.id, {
      name: input.name,
      businessDayStart: input.businessDayStart,
      tableLabels: input.tableLabels,
    }),
  );
  if (!store) return null;

  return toStoreOutput(store);
};
