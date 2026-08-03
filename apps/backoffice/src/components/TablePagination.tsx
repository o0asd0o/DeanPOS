import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";
import { Button, cn } from "ui";

import { pageWindow } from "@/lib/table.ts";

// One page strip for every list: First/Back, the numbers around the current
// page, then Next/Last. Absent entirely while everything fits on one page —
// a control that can only do nothing is noise.
export function TablePagination({
  page,
  pageCount,
  onPageChange,
  label,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label: string;
}) {
  if (pageCount < 2) return null;

  const goTo = (next: number) => {
    if (next >= 1 && next <= pageCount && next !== page) onPageChange(next);
  };

  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2 pt-3">
      <Button
        variant="outline"
        size="sm"
        aria-label="First page"
        aria-disabled={page === 1}
        onClick={() => goTo(1)}
      >
        <ChevronsLeftIcon />
        First
      </Button>
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
        Next
        <ChevronRightIcon />
      </Button>
      <Button
        variant="outline"
        size="sm"
        aria-label="Last page"
        aria-disabled={page === pageCount}
        onClick={() => goTo(pageCount)}
      >
        Last
        <ChevronsRightIcon />
      </Button>
    </nav>
  );
}
