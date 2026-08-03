import { useId } from "react";
import { Search } from "lucide-react";
import { cn, Input } from "ui";

// The pills read bare — the "Status" label above the group carries what the
// `Status:` prefix used to say on each one.
const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "deactivated", label: "Deactivated" },
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
  searchExample,
}: {
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  searchLabel: string;
  searchExample: string;
}) {
  const statusId = useId();
  const searchId = useId();

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1.5">
        <span id={statusId} className="text-xs font-medium text-muted-foreground">
          Status
        </span>
        <div
          role="group"
          aria-labelledby={statusId}
          className="inline-flex items-center gap-1 rounded-full bg-tab-list p-1.5"
        >
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              // "Deactivated" alone would shadow a row's `Deactivate <name>`
              // for anything matching by name; the verb keeps them apart.
              aria-label={`Show ${filter.label.toLowerCase()}`}
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
      </div>
      <div className="flex w-full flex-col gap-1.5 sm:w-72">
        <label htmlFor={searchId} className="text-xs font-medium text-muted-foreground">
          {searchLabel}
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={searchId}
            type="search"
            placeholder={`e.g. ${searchExample}`}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="rounded-full pr-10"
          />
        </div>
      </div>
    </div>
  );
}
