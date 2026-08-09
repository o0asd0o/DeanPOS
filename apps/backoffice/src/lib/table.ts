import { useEffect, useState } from "react";

// What every list card needs to sort and page its own rows, without either
// card owning the rules. The lists are small and arrive whole, so this is all
// client-side — a server-side page is a contract change, not a component one.
export const PAGE_SIZE = 10;

export type SortState<K extends string> = { key: K; direction: "asc" | "desc" };

// Clicking the sorted column flips it; clicking another starts that one at
// ascending, which is what a first click is asking for.
export const nextSort = <K extends string>(previous: SortState<K>, key: K): SortState<K> =>
  previous.key === key
    ? { key, direction: previous.direction === "asc" ? "desc" : "asc" }
    : { key, direction: "asc" };

export const compareValues = (a: string | number, b: string | number): number =>
  typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));

export const sortRows = <T>(
  rows: T[],
  valueOf: (row: T) => string | number,
  direction: "asc" | "desc",
): T[] =>
  [...rows].sort((a, b) => compareValues(valueOf(a), valueOf(b)) * (direction === "asc" ? 1 : -1));

// One list's view of its rows: which column sorts them, which page is shown,
// and the slice that follows from both. Hand it the already-filtered rows and
// a value per sortable column; it hands back what the table renders.
export function useTableView<T, K extends string>(
  rows: T[],
  sortValues: Record<K, (row: T) => string | number>,
  // `NoInfer` so the column set comes from `sortValues`, not from whichever
  // single key was named here.
  initialKey: NoInfer<K>,
  pageResetKey?: string,
) {
  const [sort, setSort] = useState<SortState<K>>({ key: initialKey, direction: "asc" });
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [pageResetKey]);

  const sorted = sortRows(rows, sortValues[sort.key], sort.direction);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // Clamped rather than reset: a filter that shortens the list must not strand
  // the reader on a page that no longer exists.
  const current = Math.min(page, pageCount);

  return {
    rows: sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    pageSize: PAGE_SIZE,
    totalItems: sorted.length,
    page: current,
    pageCount,
    setPage,
    // Undefined for every column but the sorted one — what `TableHead` wants.
    sortedBy: (key: K) => (sort.key === key ? sort.direction : undefined),
    sortBy: (key: K) => {
      setSort(nextSort(sort, key));
      setPage(1);
    },
  };
}

// The page numbers to draw: always show the first and last, plus the current
// page when it is between them, with one gap marker for skipped pages.
export function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 4) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 2) return [1, 2, "gap", total];
  if (current >= total - 1) return [1, "gap", total - 1, total];
  return [1, "gap", current, total];
}
