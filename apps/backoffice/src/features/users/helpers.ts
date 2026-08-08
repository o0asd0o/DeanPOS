// Mirrors `userOutputSchema` in packages/contract/src/contract.ts. Not
// inferred from the zod schema — `zod` is not a dependency of this app, and
// duplicating this one shape is cheaper than adding it.
export type UserOutput = {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "cashier" | "manager" | "admin";
  active: boolean;
  createdAt: Date;
  storeIds: string[];
};

export type UserListSortKey = "name" | "email" | "role" | "status";

export type UserListSort = { key: UserListSortKey; direction: "asc" | "desc" };

// Mirrors `userListOutputSchema` — the server-side roster page (record 076
// amends 044 §2): items already filtered/sorted/paged server-side, the
// headline's roster totals, and the pagination envelope.
export type UserListOutput = {
  items: UserOutput[];
  count: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  totalCount: number;
  activeCount: number;
};

// The one page size the server and every client call agree on.
export const EMPLOYEES_PAGE_SIZE = 10;

// Generated in the browser, never on the server and never returned by one:
// record 051 keeps 043's rule that this value exists in exactly one field.
// Six upper-case symbols with no lookalikes — record 052 trades length for
// something an admin can read aloud without a support call.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTemporaryPassword(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}
