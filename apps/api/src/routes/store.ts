import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as getStoreHandler } from "backend/src/store/handlers/get-store.ts";
import { contract } from "contract/src/index.ts";

// Only transport-aware code for `store.get` (ADR-0008 rule 5).
export const storeGetRoute = implement(contract)
  .$context<Ctx>()
  .store.get.handler(({ context, input }) => getStoreHandler({ ctx: context, input }));
