import { randomUUID } from "node:crypto";

import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertStore } from "../db-operations/commands/insert-store.command.ts";
import { toStoreOutput } from "../helpers.ts";

export const inputSchema = z.object({
  name: z.string().min(1),
  businessDayStart: z.string().min(1),
  tableLabels: z.array(z.string()),
});

type CreateStoreInput = z.infer<typeof inputSchema>;
type StoreOutput = ReturnType<typeof toStoreOutput>;

// `admin` only (issue 05 acceptance criteria); refused with `null`, the same
// not-found shape every other Store procedure uses.
export const handler: Handler<CreateStoreInput, StoreOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  const store = await withTenantScope(ctx.db, tenantId, (scopedDb) =>
    insertStore(scopedDb, {
      id: randomUUID(),
      tenantId,
      name: input.name,
      businessDayStart: input.businessDayStart,
      tableLabels: input.tableLabels,
    }),
  );

  return toStoreOutput(store);
};
