import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as listAvailability } from "backend/src/availability/handlers/list-availability.ts";
import { handler as setAvailability } from "backend/src/availability/handlers/set-availability.ts";
import { contract } from "contract/src/index.ts";

const os = implement(contract).$context<Ctx>();
export const availabilityListRoute = os.availability.list.handler(({ context, input }) =>
  listAvailability({ ctx: context, input }),
);
export const availabilitySetRoute = os.availability.set.handler(({ context, input }) =>
  setAvailability({ ctx: context, input }),
);
