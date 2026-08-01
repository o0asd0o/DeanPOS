import { oc } from "@orpc/contract";
import { z } from "zod";

export const pingOutputSchema = z.object({
  id: z.number().int(),
  message: z.string(),
  createdAt: z.date(),
});

// The only place a procedure's shape is declared. PRD "Contract".
export const contract = {
  ping: oc.input(z.void()).output(pingOutputSchema),
};
