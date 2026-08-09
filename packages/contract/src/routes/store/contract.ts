import { oc } from "@orpc/contract";
import {
  storeCreateInputSchema,
  storeIdInputSchema,
  storeListInputSchema,
  storeListOutputSchema,
  storeOutputSchema,
  storeUpdateInputSchema,
} from "./schemas.ts";

export const storeContract = {
  get: oc.input(storeIdInputSchema).output(storeOutputSchema.nullable()),
  // Refused callers receive an empty envelope, never an authorization error.
  list: oc.input(storeListInputSchema).output(storeListOutputSchema),
  // `admin` only (issue 05 acceptance criteria).
  create: oc.input(storeCreateInputSchema).output(storeOutputSchema.nullable()),
  update: oc.input(storeUpdateInputSchema).output(storeOutputSchema.nullable()),
  // Deliberately not the same procedure as `update` — a save can never
  // accidentally flip active state (record 038 §4, record 040 §3).
  deactivate: oc.input(storeIdInputSchema).output(storeOutputSchema.nullable()),
  reactivate: oc.input(storeIdInputSchema).output(storeOutputSchema.nullable()),
};
