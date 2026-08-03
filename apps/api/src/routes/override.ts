import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as listOverridesHandler } from "backend/src/override/handlers/list-overrides.ts";
import { handler as recordOverrideHandler } from "backend/src/override/handlers/record-override.ts";
import { contract } from "contract/src/index.ts";

// Only transport-aware code for `override.*`/`terminal.recordOverride`
// (ADR-0008 rule 5).
const os = implement(contract).$context<Ctx>();

export const terminalRecordOverrideRoute = os.terminal.recordOverride.handler(
  ({ context, input }) => recordOverrideHandler({ ctx: context, input }),
);

export const overrideListRoute = os.override.list.handler(({ context }) =>
  listOverridesHandler({ ctx: context, input: undefined }),
);
