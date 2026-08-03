import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getAssignedStoreIdsAsOf } from "../../access/db-operations/queries/get-assigned-store-ids-as-of.query.ts";
import { insertUserRole } from "../../access/db-operations/commands/insert-user-role.command.ts";
import { insertUserStore } from "../../access/db-operations/commands/insert-user-store.command.ts";
import { findUserById } from "../../auth/db-operations/queries/find-user-by-id.query.ts";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { updateUserRole } from "../db-operations/commands/update-user-role.command.ts";
import { toUserOutput } from "../helpers.ts";

export const inputSchema = z.object({
  id: z.string(),
  role: z.enum(["cashier", "manager", "admin"]),
  storeIds: z.array(z.string()),
});

type UpdateUserInput = z.infer<typeof inputSchema>;
type UserOutput = ReturnType<typeof toUserOutput>;

// `admin` only. Never touches `active` or the password — deactivate/
// reactivate and reset are their own procedures (record 045 §4 clause 4).
// Role and Store-assignment changes both write new append-only rows and
// never `UPDATE` one (issue 04); `User.role` and the newest `UserRole` row
// are written in the same transaction (record 045 §4 clause 3) — the two
// must never disagree, or a promotion leaves the old permissions live with
// a record saying otherwise.
export const handler: Handler<UpdateUserInput, UserOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role, userId: callerId } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  // Self-demotion is the same lockout as self-deactivation (record 044 §4
  // clause 3): refused rather than hidden, because the Select still has to
  // offer every role for every other User.
  if (callerId === input.id && input.role !== "admin") return null;

  const effectiveFrom = new Date();

  const result = await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const existing = await findUserById(scopedDb, input.id);
    if (!existing) return null;

    if (existing.role !== input.role) {
      await updateUserRole(scopedDb, input.id, input.role);
      await insertUserRole(scopedDb, {
        id: randomUUID(),
        tenantId,
        userId: input.id,
        role: input.role,
        effectiveFrom,
      });
    }

    const currentStoreIds = new Set(
      await getAssignedStoreIdsAsOf(scopedDb, input.id, effectiveFrom),
    );
    const desiredStoreIds = new Set(input.storeIds);

    for (const storeId of desiredStoreIds) {
      if (currentStoreIds.has(storeId)) continue;
      await insertUserStore(scopedDb, {
        id: randomUUID(),
        tenantId,
        userId: input.id,
        storeId,
        assigned: true,
        effectiveFrom,
      });
    }
    for (const storeId of currentStoreIds) {
      if (desiredStoreIds.has(storeId)) continue;
      await insertUserStore(scopedDb, {
        id: randomUUID(),
        tenantId,
        userId: input.id,
        storeId,
        assigned: false,
        effectiveFrom,
      });
    }

    return findUserById(scopedDb, input.id);
  });

  if (!result) return null;
  return toUserOutput(result, input.storeIds);
};
