import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as getTenantSettingsHandler } from "backend/src/tenant-settings/handlers/get-tenant-settings.ts";
import { handler as updateTenantSettingsHandler } from "backend/src/tenant-settings/handlers/update-tenant-settings.ts";
import { contract } from "contract/src/index.ts";

// Only transport-aware code for `settings.*` (ADR-0008 rule 5).
const os = implement(contract).$context<Ctx>();

export const settingsGetRoute = os.settings.get.handler(({ context }) =>
  getTenantSettingsHandler({ ctx: context, input: undefined }),
);
export const settingsUpdateRoute = os.settings.update.handler(({ context, input }) =>
  updateTenantSettingsHandler({ ctx: context, input }),
);
