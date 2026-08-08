import { oc } from "@orpc/contract";
import {
  userCreateInputSchema,
  userIdInputSchema,
  userListInputSchema,
  userListOutputSchema,
  userOutputSchema,
  userResetPasswordInputSchema,
  userResetPinOutputSchema,
  userSetPinInputSchema,
  userSetPinOutputSchema,
  userUpdateInputSchema,
} from "./schemas.ts";

// Back-office User management (issue 06, record 044 §2). Deactivate/
// reactivate/resetPassword stay out of `update` (records 040 §3, 043).
export const userContract = {
  list: oc.input(userListInputSchema).output(userListOutputSchema),
  create: oc.input(userCreateInputSchema).output(userOutputSchema.nullable()),
  update: oc.input(userUpdateInputSchema).output(userOutputSchema.nullable()),
  deactivate: oc.input(userIdInputSchema).output(userOutputSchema.nullable()),
  reactivate: oc.input(userIdInputSchema).output(userOutputSchema.nullable()),
  resetPassword: oc.input(userResetPasswordInputSchema).output(userOutputSchema.nullable()),
  // PIN set/change (self) and reset (admin) — issue 10. Never the same
  // procedure as the password ones; the hash never rides an output.
  setPin: oc.input(userSetPinInputSchema).output(userSetPinOutputSchema),
  resetPin: oc.input(userIdInputSchema).output(userResetPinOutputSchema),
};
