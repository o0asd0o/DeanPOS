import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  availabilityListInputSchema,
  availabilityPageSchema,
  availabilitySetInputSchema,
} from "./schemas.ts";

export const availabilityContract = {
  set: oc
    .input(availabilitySetInputSchema)
    .output(z.object({ version: z.string().regex(/^[0-9a-f]{64}$/) }).nullable()),
  list: oc.input(availabilityListInputSchema).output(availabilityPageSchema),
};
