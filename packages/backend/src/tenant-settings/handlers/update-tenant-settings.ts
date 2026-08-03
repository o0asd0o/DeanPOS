import { randomUUID } from "node:crypto";

import { z } from "zod";
import { timezoneSchema } from "schemas/src/timezones.ts";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { insertTenantSettingsAudit } from "../db-operations/commands/insert-tenant-settings-audit.command.ts";
import { updateTenantSettings } from "../db-operations/commands/update-tenant-settings.command.ts";
import { getTenantSettings } from "../db-operations/queries/get-tenant-settings.query.ts";
import { diffTenantSettings, toTenantSettingsOutput } from "../helpers.ts";

export const inputSchema = z.object({
  timezone: timezoneSchema,
  vatEnabled: z.boolean(),
  vatRatePercent: z.number().int().min(0),
  varianceToleranceCentavos: z.number().int().min(0),
  cashMovementOverrideThresholdCentavos: z.number().int().min(0),
});

type UpdateTenantSettingsInput = z.infer<typeof inputSchema>;
type TenantSettingsOutput = ReturnType<typeof toTenantSettingsOutput>;

// `admin` only (issue 07 criterion 3). One form, one Save, but one audit row
// per changed setting (record 046 §"Three smaller calls") — a save that
// changes nothing writes none.
export const handler: Handler<UpdateTenantSettingsInput, TenantSettingsOutput | null> = async ({
  ctx,
  input,
}) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return null;
  const { tenantId, userId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return null;

  const result = await withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    const before = await getTenantSettings(scopedDb, tenantId);
    if (!before) return null;
    const beforeOutput = toTenantSettingsOutput(before);

    const after = await updateTenantSettings(scopedDb, tenantId, input);
    if (!after) return null;
    const afterOutput = toTenantSettingsOutput(after);

    const changes = diffTenantSettings(beforeOutput, afterOutput);
    for (const change of changes) {
      await insertTenantSettingsAudit(scopedDb, {
        id: randomUUID(),
        tenantId,
        actorUserId: userId,
        setting: change.setting,
        oldValue: change.oldValue,
        newValue: change.newValue,
      });
    }

    return afterOutput;
  });

  return result;
};
