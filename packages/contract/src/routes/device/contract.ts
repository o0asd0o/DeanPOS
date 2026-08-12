import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  deviceGenerateCodeInputSchema,
  deviceGenerateCodeOutputSchema,
  deviceIdInputSchema,
  deviceListInputSchema,
  deviceListOutputSchema,
  deviceOutputSchema,
  devicePendingCodeSchema,
  deviceRenameInputSchema,
  deviceSetAssignedUserInputSchema,
  deviceUpdateInputSchema,
} from "./schemas.ts";

export const deviceContract = {
  list: oc.input(deviceListInputSchema).output(deviceListOutputSchema),
  pendingCodes: oc.input(z.void()).output(z.array(devicePendingCodeSchema)),
  cancelCode: oc.input(deviceIdInputSchema).output(z.object({ ok: z.boolean() })),
  generateCode: oc.input(deviceGenerateCodeInputSchema).output(deviceGenerateCodeOutputSchema),
  rename: oc.input(deviceRenameInputSchema).output(deviceOutputSchema.nullable()),
  revoke: oc.input(deviceIdInputSchema).output(deviceOutputSchema.nullable()),
  setAssignedUser: oc.input(deviceSetAssignedUserInputSchema).output(deviceOutputSchema.nullable()),
  update: oc.input(deviceUpdateInputSchema).output(deviceOutputSchema.nullable()),
};
