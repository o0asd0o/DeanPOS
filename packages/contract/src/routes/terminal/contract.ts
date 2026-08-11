import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  recordOverrideInputSchema,
  recordOverrideOutputSchema,
  receiptInputSchema,
  receiptOutputSchema,
  submitOrderInputSchema,
  submitOrderOutputSchema,
  terminalEnrolInputSchema,
  terminalEnrolOutputSchema,
  terminalHeartbeatOutputSchema,
  terminalMeOutputSchema,
  terminalPinSyncOutputSchema,
} from "./schemas.ts";

export const terminalContract = {
  enrol: oc.input(terminalEnrolInputSchema).output(terminalEnrolOutputSchema),
  me: oc.input(z.void()).output(terminalMeOutputSchema),
  heartbeat: oc.input(z.void()).output(terminalHeartbeatOutputSchema),
  pinSync: oc.input(z.void()).output(terminalPinSyncOutputSchema),
  recordOverride: oc.input(recordOverrideInputSchema).output(recordOverrideOutputSchema),
  submitOrder: oc.input(submitOrderInputSchema).output(submitOrderOutputSchema),
  receipt: oc.input(receiptInputSchema).output(receiptOutputSchema),
};
