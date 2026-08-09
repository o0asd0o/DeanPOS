// One editable table label. Rows are keyed by `id`, not index, so a row keeps
// its DOM node — and with it, focus — across reorders (record 039 §1).
export type LabelRow = { id: string; value: string };

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

export type StoreListSortKey = "name" | "businessDayStart" | "tableLabels" | "status";
export type StoreListSort = { key: StoreListSortKey; direction: "asc" | "desc" };
export type StoreListOutput = {
  items: StoreOutput[];
  count: number;
  page: number;
  perPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  totalCount: number;
  activeCount: number;
};
export const STORES_PAGE_SIZE = 10;
