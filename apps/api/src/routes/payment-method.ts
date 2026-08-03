import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as createPaymentMethodHandler } from "backend/src/payment-method/handlers/create-payment-method.ts";
import { handler as deactivatePaymentMethodHandler } from "backend/src/payment-method/handlers/deactivate-payment-method.ts";
import { handler as listPaymentMethodsHandler } from "backend/src/payment-method/handlers/list-payment-methods.ts";
import { handler as reactivatePaymentMethodHandler } from "backend/src/payment-method/handlers/reactivate-payment-method.ts";
import { handler as updatePaymentMethodHandler } from "backend/src/payment-method/handlers/update-payment-method.ts";
import { contract } from "contract/src/index.ts";

// Only transport-aware code for `paymentMethod.*` (ADR-0008 rule 5).
const os = implement(contract).$context<Ctx>();

export const paymentMethodListRoute = os.paymentMethod.list.handler(({ context }) =>
  listPaymentMethodsHandler({ ctx: context, input: undefined }),
);
export const paymentMethodCreateRoute = os.paymentMethod.create.handler(({ context, input }) =>
  createPaymentMethodHandler({ ctx: context, input }),
);
export const paymentMethodUpdateRoute = os.paymentMethod.update.handler(({ context, input }) =>
  updatePaymentMethodHandler({ ctx: context, input }),
);
export const paymentMethodDeactivateRoute = os.paymentMethod.deactivate.handler(
  ({ context, input }) => deactivatePaymentMethodHandler({ ctx: context, input }),
);
export const paymentMethodReactivateRoute = os.paymentMethod.reactivate.handler(
  ({ context, input }) => reactivatePaymentMethodHandler({ ctx: context, input }),
);
