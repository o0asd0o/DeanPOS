import { ORPCError } from "@orpc/server";

// Reusable wrong-tenant probe (issue 01): assert a procedure run as one
// Tenant, addressing another Tenant's id, refuses — a null/empty result or
// a NOT_FOUND ORPCError whose message doesn't confirm the row exists.
export async function expectWrongTenantRefusal<T>(
  attempt: () => Promise<T>,
  isRefusal: (result: T) => boolean,
): Promise<void> {
  let result: T;
  try {
    result = await attempt();
  } catch (error) {
    if (!(error instanceof ORPCError) || error.code !== "NOT_FOUND") throw error;
    if (/tenant|exists/i.test(error.message)) {
      throw new Error(`wrong-tenant probe: error message may confirm existence: ${error.message}`);
    }
    return;
  }

  if (!isRefusal(result)) {
    throw new Error(
      "wrong-tenant probe: expected not-found or empty, received another Tenant's row",
    );
  }
}
