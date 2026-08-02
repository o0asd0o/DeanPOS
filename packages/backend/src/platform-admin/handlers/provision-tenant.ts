import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { hashPassword } from "../../common/password.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertPlatformAuditLog } from "../db-operations/commands/insert-platform-audit-log.command.ts";
import { insertTenant } from "../db-operations/commands/insert-tenant.command.ts";
import { insertUser } from "../db-operations/commands/insert-user.command.ts";

export const inputSchema = z.object({
  tenantName: z.string().min(1),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
});

type ProvisionTenantInput = z.infer<typeof inputSchema>;
type ProvisionTenantOutput = { tenantId: string; userId: string };

// Platform-admin only, refused with `null` (ADR-0008 rule 2). Issue 02.
export const handler: Handler<ProvisionTenantInput, ProvisionTenantOutput | null> = async ({
  ctx,
  input,
}) => {
  if (ctx.kind !== "platform-admin") return null;

  const tenantId = randomUUID();
  const userId = randomUUID();
  const passwordHash = await hashPassword(input.adminPassword);

  // Scoped to the Tenant being minted, not to any existing principal — the
  // provisioning transaction's own tenant_id is the new Tenant's id, which
  // is what the Tenant/User RLS policies check against
  // (packages/backend/src/db/prisma/migrations/20260802080203_platform_admin_tenant_provisioning).
  await withTenantScope(ctx.db, tenantId, async (db) => {
    await insertTenant(db, { id: tenantId, name: input.tenantName });
    await insertUser(db, {
      id: userId,
      tenantId,
      email: input.adminEmail,
      passwordHash,
      role: "admin",
    });
    await insertPlatformAuditLog(db, {
      id: randomUUID(),
      platformAdminId: ctx.platformAdmin.platformAdminId,
      action: "provision_tenant",
      tenantId,
    });
  });

  return { tenantId, userId };
};
