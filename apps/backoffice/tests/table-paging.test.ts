import { describe, expect, it } from "vite-plus/test";

import { formatPaginationSummary } from "@/components/TablePagination.tsx";
import { nextSort, pageWindow, sortRows } from "@/lib/table.ts";

describe("the list tables' sort and page rules", () => {
  it("keeps a compact page window with the ends always shown", () => {
    expect(pageWindow(1, 25)).toEqual([1, 2, "gap", 25]);
    expect(pageWindow(12, 25)).toEqual([1, "gap", 12, 25]);
    expect(pageWindow(25, 25)).toEqual([1, "gap", 24, 25]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });

  it("flips the sorted column and starts a new one ascending", () => {
    const first = { key: "name", direction: "asc" } as const;
    expect(nextSort(first, "name")).toEqual({ key: "name", direction: "desc" });
    expect(nextSort({ key: "name", direction: "desc" }, "email")).toEqual({
      key: "email",
      direction: "asc",
    });
  });

  it("sorts numbers numerically, not as text", () => {
    const rows = [{ n: 10 }, { n: 2 }, { n: 1 }];
    expect(sortRows(rows, (row) => row.n, "asc").map((row) => row.n)).toEqual([1, 2, 10]);
    expect(sortRows(rows, (row) => row.n, "desc").map((row) => row.n)).toEqual([10, 2, 1]);
    // The input is left alone — the caller's list is still filter order.
    expect(rows.map((row) => row.n)).toEqual([10, 2, 1]);
  });

  it("formats the visible range for the shared pagination strip", () => {
    expect(formatPaginationSummary(2, 10, 10, 42)).toBe("Showing 11–20 of 42");
    expect(formatPaginationSummary(1, 10, 0, 0)).toBe("Showing 0 of 0");
  });
});
