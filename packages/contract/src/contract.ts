import { oc } from "@orpc/contract";
import { z } from "zod";

export const pingOutputSchema = z.object({
  id: z.number().int(),
  message: z.string(),
  createdAt: z.date(),
});

/**
 * The only place a procedure's shape is declared (PRD "Contract"). `apps/api`
 * implements against this; `apps/pos` and `apps/backoffice` consume a typed
 * client built from it. `implement(contract)` fails typecheck on a key
 * missing from the router it is given — see the route binding for the
 * property this buys.
 */
export const contract = {
  ping: oc.input(z.void()).output(pingOutputSchema),
};
