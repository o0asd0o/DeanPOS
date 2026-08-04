import { ORPCError } from "@orpc/client";

// A rejection on policy (record 032) arrives as oRPC's own input-validation
// error, carrying the zod issue message; anything else is a real transport
// failure. Shared by /set-password and /account's password section (issue 16).
export function policyRejectionMessage(error: unknown): string | null {
  if (!(error instanceof ORPCError) || error.code !== "BAD_REQUEST") return null;
  const data = error.data as { issues?: { message?: string }[] } | undefined;
  return data?.issues?.[0]?.message ?? null;
}
