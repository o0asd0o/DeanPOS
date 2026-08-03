import { ORPCError } from "@orpc/server";

// Reusable wrong-tenant probe (issue 01, rebuilt issue 13 / record 062): the
// caller cannot supply its own idea of "refused" — this helper owns the
// refusal shapes, so a probe cannot be satisfied by a hand-picked predicate.
export type WrongTenantProbeMode = "refusal" | "confined" | "shared";

export type WrongTenantProbeArgs<T> = {
  /** The dotted contract path this probe covers, e.g. "store.update". */
  path: string;
  mode: WrongTenantProbeMode;
  /** What the owning Tenant read through its own authorised path. Required, non-empty. */
  ownerSees: T;
  /** Thunk so a thrown ORPCError (e.g. NOT_FOUND) can be caught. */
  otherGets: () => Promise<T>;
  /** mode "confined" only: what the other Tenant should see of its own data. */
  otherOwn?: T;
  /** mode "shared" only: why this procedure is genuinely tenant-neutral. Min 20 chars. */
  why?: string;
};

function isRefusalShape(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("ok" in record && record.ok === false) return true;
    if ("authenticated" in record && record.authenticated === false) return true;
  }
  return false;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => deepEqual(value, b[index]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) =>
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
  }
  return false;
}

export async function expectWrongTenantRefusal<T>({
  path,
  mode,
  ownerSees,
  otherGets,
  otherOwn,
  why,
}: WrongTenantProbeArgs<T>): Promise<void> {
  if (isRefusalShape(ownerSees)) {
    throw new Error(
      `wrong-tenant probe [${path}]: ownerSees is empty — an empty result is also the authorised answer, so this probe would pass against a table with no rows in it.`,
    );
  }
  if (mode === "confined" && (otherOwn === undefined || isRefusalShape(otherOwn))) {
    throw new Error(
      `wrong-tenant probe [${path}]: mode "confined" requires the other Tenant's result to equal otherOwn.`,
    );
  }
  if (mode === "shared" && (!why || why.length < 20)) {
    throw new Error(
      `wrong-tenant probe [${path}]: mode "shared" requires a written why of at least 20 characters.`,
    );
  }

  let result: T;
  try {
    result = await otherGets();
  } catch (error) {
    if (!(error instanceof ORPCError) || error.code !== "NOT_FOUND") throw error;
    if (/tenant|exists/i.test(error.message)) {
      throw new Error(`wrong-tenant probe [${path}]: error message may confirm existence: ${error.message}`);
    }
    if (mode !== "refusal") {
      throw new Error(`wrong-tenant probe [${path}]: unexpected NOT_FOUND for mode "${mode}".`);
    }
    return;
  }

  // Mode "shared" wants equality, so its own check below replaces this one.
  if (mode !== "shared" && deepEqual(result, ownerSees)) {
    throw new Error(`wrong-tenant probe [${path}]: the other Tenant received the owner's own result.`);
  }

  if (mode === "refusal") {
    if (!isRefusalShape(result)) {
      throw new Error(
        `wrong-tenant probe [${path}]: expected a refusal shape (null, [], {ok:false}, {authenticated:false}) or NOT_FOUND, received ${JSON.stringify(result)}.`,
      );
    }
    return;
  }

  if (mode === "confined") {
    if (isRefusalShape(result) || !deepEqual(result, otherOwn)) {
      throw new Error(
        `wrong-tenant probe [${path}]: mode "confined" requires the other Tenant's result to equal otherOwn.`,
      );
    }
    return;
  }

  if (isRefusalShape(result) || !deepEqual(result, ownerSees)) {
    throw new Error(`wrong-tenant probe [${path}]: mode "shared" requires both Tenants to receive identical data.`);
  }
}
