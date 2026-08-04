import { ORPCError } from "@orpc/server";

// Reusable wrong-tenant probe (issue 01, rebuilt issue 13 / record 062): the
// caller cannot supply its own idea of "refused" — this helper owns the
// refusal shapes, so a probe cannot be satisfied by a hand-picked predicate.
export type WrongTenantProbeMode = "refusal" | "confined" | "effect" | "shared";

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
  /** mode "effect" only: the other Tenant's own data before the owner's write. */
  otherBefore?: unknown;
  /** mode "effect" only: re-reads that same other-Tenant data after the write. */
  otherAfter?: () => Promise<unknown>;
  /** modes "shared"/"effect" only: why this result carries no tenant data. Min 20 chars. */
  why?: string;
};

// Exact refusal shapes only (record 062) — an object carrying `ok: false`
// plus other keys is a leak riding along with a refusal, not a refusal.
function isRefusalShape(value: unknown): boolean {
  if (value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    const record = value as Record<string, unknown>;
    if (keys.length === 1 && keys[0] === "ok" && record.ok === false) return true;
    if (keys.length === 1 && keys[0] === "authenticated" && record.authenticated === false) {
      return true;
    }
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
  otherBefore,
  otherAfter,
  why,
}: WrongTenantProbeArgs<T>): Promise<void> {
  if (ownerSees === undefined || isRefusalShape(ownerSees)) {
    throw new Error(
      `wrong-tenant probe [${path}]: ownerSees is empty — an empty result is also the authorised answer, so this probe would pass against a table with no rows in it.`,
    );
  }
  if (mode === "confined" && (otherOwn === undefined || isRefusalShape(otherOwn))) {
    throw new Error(
      `wrong-tenant probe [${path}]: mode "confined" requires the other Tenant's result to equal otherOwn.`,
    );
  }
  if (mode === "effect" && (otherBefore === undefined || typeof otherAfter !== "function")) {
    throw new Error(
      `wrong-tenant probe [${path}]: mode "effect" requires otherBefore and otherAfter, so the helper can prove the write left the other Tenant's data untouched.`,
    );
  }
  if ((mode === "shared" || mode === "effect") && (!why || why.length < 20)) {
    throw new Error(
      `wrong-tenant probe [${path}]: mode "${mode}" requires a written why of at least 20 characters.`,
    );
  }

  let result: T;
  try {
    result = await otherGets();
  } catch (error) {
    if (!(error instanceof ORPCError) || error.code !== "NOT_FOUND") throw error;
    if (/tenant|exists/i.test(error.message)) {
      throw new Error(
        `wrong-tenant probe [${path}]: error message may confirm existence: ${error.message}`,
      );
    }
    if (mode !== "refusal") {
      throw new Error(`wrong-tenant probe [${path}]: unexpected NOT_FOUND for mode "${mode}".`);
    }
    return;
  }

  // Modes "shared" and "effect" want equality, so their own checks below replace this one.
  if (mode !== "shared" && mode !== "effect" && deepEqual(result, ownerSees)) {
    throw new Error(
      `wrong-tenant probe [${path}]: the other Tenant received the owner's own result.`,
    );
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

  if (mode === "effect") {
    if (isRefusalShape(result) || !deepEqual(result, ownerSees)) {
      throw new Error(
        `wrong-tenant probe [${path}]: mode "effect" requires both Tenants' own trivial results to match.`,
      );
    }
    if (!deepEqual(await otherAfter!(), otherBefore)) {
      throw new Error(
        `wrong-tenant probe [${path}]: mode "effect" requires the other Tenant's data to remain unaffected by the owner's write, but the before/after read differ.`,
      );
    }
    return;
  }

  if (isRefusalShape(result) || !deepEqual(result, ownerSees)) {
    throw new Error(
      `wrong-tenant probe [${path}]: mode "shared" requires both Tenants to receive identical data.`,
    );
  }
}
