// Mirrors `storeOutputSchema` in packages/contract/src/contract.ts. Not
// inferred from the zod schema — `zod` is not a dependency of this app, and
// duplicating this one shape is cheaper than adding it.
export type StoreOutput = {
  id: string;
  tenantId: string;
  name: string;
  businessDayStart: string;
  tableLabels: string[];
  active: boolean;
  createdAt: Date;
};
