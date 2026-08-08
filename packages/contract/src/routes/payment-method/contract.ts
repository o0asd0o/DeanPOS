import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  paymentMethodCreateInputSchema,
  paymentMethodIdInputSchema,
  paymentMethodOutputSchema,
  paymentMethodPaymentDetailsOutputSchema,
  paymentMethodUpdateInputSchema,
} from "./schemas.ts";

// Payment methods (issue 08, record 054). `admin`-only; `null` for any
// non-admin or unauthenticated caller, same shape as store.get.
export const paymentMethodContract = {
  list: oc.input(z.void()).output(z.array(paymentMethodOutputSchema)),
  create: oc
    .input(paymentMethodCreateInputSchema)
    .output(paymentMethodOutputSchema.nullable()),
  update: oc
    .input(paymentMethodUpdateInputSchema)
    .output(paymentMethodOutputSchema.nullable()),
  // Deliberately not `update` — a save can never accidentally flip active
  // state (record 040 §3, carried into record 054 Q3).
  deactivate: oc
    .input(paymentMethodIdInputSchema)
    .output(paymentMethodOutputSchema.nullable()),
  reactivate: oc
    .input(paymentMethodIdInputSchema)
    .output(paymentMethodOutputSchema.nullable()),
  // The editor's own fetch when it opens for edit (issue 14) — never
  // riding `list`, which keeps `list`'s output shape unchanged.
  getPaymentDetails: oc
    .input(paymentMethodIdInputSchema)
    .output(paymentMethodPaymentDetailsOutputSchema.nullable()),
};
