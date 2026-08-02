import { ORPCError } from "@orpc/server";

// The reusable wrong-tenant probe (issue 01, tenant-isolation-spine): call a
// procedure authenticated as one Tenant, addressing another Tenant's id, and
// assert the answer is not-found or empty — never that Tenant's row, and
// never an error message that confirms the row exists. Eight later areas
// call this; it is a deliverable of the tenancy-identity PRD, not a
// convenience local to this issue.
//
// A procedure may refuse either way: by returning something `isRefusal`
// accepts (this issue's `store.get` returns `null`), or by throwing a
// `NOT_FOUND` `ORPCError`. Any other thrown error is not a refusal — it
// propagates, so a real bug still fails the test.
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
