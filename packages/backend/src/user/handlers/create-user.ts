import { randomUUID } from "node:crypto";

import { z } from "zod";

import { insertUserRole } from "../../access/db-operations/commands/insert-user-role.command.ts";
import { insertUserStore } from "../../access/db-operations/commands/insert-user-store.command.ts";
import { passwordSchema } from "../../auth/password-policy.ts";
import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { hashPassword } from "../../common/password.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertUser } from "../db-operations/commands/insert-user.command.ts";
import { toUserOutput } from "../helpers.ts";

export const inputSchema = z.object({
  email: z.string().email(),
  role: z.enum(["cashier", "manager", "admin"]),
  password: passwordSchema,
  storeIds: z.array(z.string()),
});

type CreateUserInput = z.infer<typeof inputSchema>;
type UserOutput = ReturnType<typeof toUserOutput>;

// `admin` only (record 044 §2). The opening `UserRole` row and every Store
// assignment are written in the same transaction as the User row — a User
// must never exist without one (issue 04, round 1 finding 1).
export const handler: Handler<CreateUserInput, UserOutput | null> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.role) return null;
  const { tenantId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  const userId = randomUUID();
  const passwordHash = await hashPassword(input.password);
  const effectiveFrom = new Date();

  const user = await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const inserted = await insertUser(scopedDb, {
      id: userId,
      tenantId,
      email: input.email,
      passwordHash,
      role: input.role,
    });
    await insertUserRole(scopedDb, {
      id: randomUUID(),
      tenantId,
      userId,
      role: input.role,
      effectiveFrom,
    });
    for (const storeId of input.storeIds) {
      await insertUserStore(scopedDb, {
        id: randomUUID(),
        tenantId,
        userId,
        storeId,
        assigned: true,
        effectiveFrom,
      });
    }
    return inserted;
  });

  return toUserOutput(user, input.storeIds);
};
