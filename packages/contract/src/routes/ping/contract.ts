import { oc } from "@orpc/contract";
import { z } from "zod";
import { pingOutputSchema } from "./schemas.ts";

export const pingContract = oc.input(z.void()).output(pingOutputSchema);
