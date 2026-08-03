import { Search } from "lucide-react";
import { cn, Input } from "ui";

// Every label carries the `Status:` prefix: a bare `Deactivated` pill would
// shadow a row's `Deactivate <name>` action for anything matching by name.
const STATUS_FILTERS = [
  { value: "all", label: "Status: All" },
  { value: "active", label: "Status: Active" },
  { value: "deactivated", label: "Status: Deactivated" },
] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

// The list card's own toolbar (record 044 §§1–2): status pills left, search
// right, both inside the card so the page header stays title and one action.
export function ListToolbar({
  status,
  onStatusChange,
  query,
  onQueryChange,
  searchLabel,
}: {
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  searchLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div
        role="group"
        aria-label="Filter by status"
        className="inline-flex items-center gap-1 rounded-full bg-tab-list p-1.5"
      >
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={status === filter.value}
            onClick={() => onStatusChange(filter.value)}
            className={cn(
              "tap-target rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
              status === filter.value
                ? "bg-card text-foreground shadow-sm"
                : "text-foreground/60 hover:text-foreground",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="relative w-full sm:w-72">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="rounded-full pr-10"
        />
      </div>
    </div>
  );
}
