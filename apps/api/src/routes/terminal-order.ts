import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as submitOrderHandler } from "backend/src/order/handlers/submit-order.ts";
import { contract } from "contract/src/index.ts";

const os = implement(contract).$context<Ctx>();

export const terminalSubmitOrderRoute = os.terminal.submitOrder.handler(({ context, input }) =>
  submitOrderHandler({ ctx: context, input }),
);
