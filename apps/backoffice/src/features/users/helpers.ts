// Mirrors `userOutputSchema` in packages/contract/src/contract.ts. Not
// inferred from the zod schema — `zod` is not a dependency of this app, and
// duplicating this one shape is cheaper than adding it.
export type UserOutput = {
  id: string;
  tenantId: string;
  email: string;
  role: "cashier" | "manager" | "admin";
  active: boolean;
  createdAt: Date;
  storeIds: string[];
};

// Generated in the browser, never on the server and never returned by one:
// record 051 keeps 043's rule that this value exists in exactly one field.
// Six upper-case symbols with no lookalikes — record 052 trades length for
// something an admin can read aloud without a support call.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTemporaryPassword(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}
