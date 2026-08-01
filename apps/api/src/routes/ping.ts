import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as pingHandler } from "backend/src/ping/handlers/get-ping.ts";
import { contract } from "contract/src/index.ts";

/**
 * The only transport-aware code for `ping` (ADR-0008 rule 5): binds the
 * contract procedure to the backend handler and does nothing else.
 * `RPCHandler` validates the request against the contract's `inputSchema`
 * before this ever runs — true for every procedure, stated here because
 * `ping` takes none (security criterion 8).
 */
export const pingRoute = implement(contract)
  .$context<Ctx>()
  .ping.handler(({ context, input }) => pingHandler({ ctx: context, input }));
