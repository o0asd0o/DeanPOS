import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as pingHandler } from "backend/src/ping/handlers/get-ping.ts";
import { contract } from "contract/src/index.ts";

// Only transport-aware code for `ping` (ADR-0008 rule 5). RPCHandler validates
// input against the contract's schema before this runs — security criterion 8.
export const pingRoute = implement(contract)
  .$context<Ctx>()
  .ping.handler(({ context, input }) => pingHandler({ ctx: context, input }));
