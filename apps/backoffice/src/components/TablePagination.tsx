import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button, cn } from "ui";

import { pageWindow } from "@/lib/table.ts";

export function formatPaginationSummary(
  page: number,
  pageSize: number,
  itemCount: number,
  totalItems: number,
): string {
  if (totalItems === 0) return "Showing 0 of 0";

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(firstItem + itemCount - 1, totalItems);
  return `Showing ${firstItem}–${lastItem} of ${totalItems}`;
}

// One page strip for every list: icon-only Back/Next around a compact page
// window. Absent entirely while everything fits on one page —
// a control that can only do nothing is noise.
export function TablePagination({
  page,
  pageCount,
  onPageChange,
  label,
  pageSize,
  itemCount,
  totalItems,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label: string;
  pageSize: number;
  itemCount: number;
  totalItems: number;
}) {
  if (totalItems === 0) return null;

  const goTo = (next: number) => {
    if (next >= 1 && next <= pageCount && next !== page) onPageChange(next);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        {formatPaginationSummary(page, pageSize, itemCount, totalItems)}
      </p>
      {pageCount >= 2 && (
        <nav aria-label={label} className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Previous page"
            aria-disabled={page === 1}
            onClick={() => goTo(page - 1)}
          >
            <ChevronLeftIcon />
            Back
          </Button>
          {pageWindow(page, pageCount).map((entry, index) =>
            entry === "gap" ? (
              <span
                key={`gap-${index}`}
                aria-hidden="true"
                className="grid size-9 place-items-center rounded-full border text-muted-foreground"
              >
                …
              </span>
            ) : (
              <Button
                key={entry}
                variant={entry === page ? "default" : "outline"}
                size="icon-sm"
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? "page" : undefined}
                className={cn(entry === page && "pointer-events-none")}
                onClick={() => goTo(entry)}
              >
                {entry}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="sm"
            aria-label="Next page"
            aria-disabled={page === pageCount}
            onClick={() => goTo(page + 1)}
          >
            <ChevronRightIcon />
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
