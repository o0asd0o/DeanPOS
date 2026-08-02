import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as provisionTenantHandler } from "backend/src/platform-admin/handlers/provision-tenant.ts";
import { contract } from "contract/src/index.ts";

// Only transport-aware code for `platformAdmin.provisionTenant` (ADR-0008 rule 5).
export const provisionTenantRoute = implement(contract)
  .$context<Ctx>()
  .platformAdmin.provisionTenant.handler(({ context, input }) =>
    provisionTenantHandler({ ctx: context, input }),
  );
