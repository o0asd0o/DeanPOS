import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  storeCreateInputSchema,
  storeIdInputSchema,
  storeOutputSchema,
  storeUpdateInputSchema,
} from "./schemas.ts";

export const storeContract = {
  get: oc.input(storeIdInputSchema).output(storeOutputSchema.nullable()),
  // Never discloses a Store the caller may not see — no count, no total
  // (record 038 §6). Refused entirely for `cashier`.
  list: oc.input(z.void()).output(z.array(storeOutputSchema)),
  // `admin` only (issue 05 acceptance criteria).
  create: oc.input(storeCreateInputSchema).output(storeOutputSchema.nullable()),
  update: oc.input(storeUpdateInputSchema).output(storeOutputSchema.nullable()),
  // Deliberately not the same procedure as `update` — a save can never
  // accidentally flip active state (record 038 §4, record 040 §3).
  deactivate: oc.input(storeIdInputSchema).output(storeOutputSchema.nullable()),
  reactivate: oc.input(storeIdInputSchema).output(storeOutputSchema.nullable()),
};
