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

// The page numbers to draw: always the first and last, a run of five around
// the current page, and a gap marker wherever the run breaks.
export function pageWindow(current: number, total: number): (number | "gap")[] {
  // Anchored so the run stays five wide at either end (1-5, or last-4..last).
  const start = Math.min(Math.max(current - 2, 1), Math.max(total - 4, 1));
  const run = [0, 1, 2, 3, 4].map((offset) => start + offset);

  const shown = [...new Set([1, ...run, total])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  return shown.flatMap((page, index) =>
    index > 0 && page - shown[index - 1]! > 1 ? ["gap" as const, page] : [page],
  );
}
