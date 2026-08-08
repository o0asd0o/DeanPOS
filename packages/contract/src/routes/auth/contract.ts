import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  changePasswordInputSchema,
  changePasswordOutputSchema,
  meOutputSchema,
  setPasswordInputSchema,
  setPasswordOutputSchema,
  signInInputSchema,
  signInOutputSchema,
  signOutOutputSchema,
} from "./schemas.ts";

// Back-office sign-in and session (issue 03). Cookie-authenticated; every
// one of these requires an exact `Origin: https://admin.<domain>` match.
export const authContract = {
  signIn: oc.input(signInInputSchema).output(signInOutputSchema),
  signOut: oc.input(z.void()).output(signOutOutputSchema),
  setPassword: oc.input(setPasswordInputSchema).output(setPasswordOutputSchema),
  changePassword: oc.input(changePasswordInputSchema).output(changePasswordOutputSchema),
  me: oc.input(z.void()).output(meOutputSchema),
};
