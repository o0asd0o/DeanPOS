import { oc } from "@orpc/contract";
import { z } from "zod";
import { overrideOutputSchema } from "./schemas.ts";

export const overrideContract = {
  list: oc.input(z.void()).output(z.array(overrideOutputSchema).nullable()),
};
