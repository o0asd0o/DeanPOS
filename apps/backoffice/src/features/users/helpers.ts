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
