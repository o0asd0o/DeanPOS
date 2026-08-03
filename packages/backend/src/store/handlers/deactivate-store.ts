import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { setStoreActive } from "../db-operations/commands/set-store-active.command.ts";
import { toStoreOutput } from "../helpers.ts";

export const inputSchema = z.object({ id: z.string() });

type StoreOutput = ReturnType<typeof toStoreOutput>;

// `admin` only. Never hard-deletes — flips `active` to false, which is
// what stops a Store being offered for new work (issue 01, record 038 §4).
export const handler: Handler<{ id: string }, StoreOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  const store = await withTenantScope(ctx.db, tenantId, (scopedDb) =>
    setStoreActive(scopedDb, input.id, false),
  );
  if (!store) return null;

  return toStoreOutput(store);
};
