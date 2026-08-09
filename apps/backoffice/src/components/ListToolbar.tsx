import { useId, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn, Input } from "ui";

export type StatusFilter = "all" | "active" | "deactivated";
export type HealthFilter = "all" | "online" | "stale" | "offline";
export type RoleFilter = "all" | "cashier" | "manager" | "admin";
export type ReachFilter = "all" | "live" | "nostores" | "deactivated";
export type SellabilityFilter = "all" | "live" | "draft" | "archived";
export type UsageFilter = "all" | "inuse" | "needsattention" | "unused";
export type ListFilter =
  | StatusFilter
  | HealthFilter
  | RoleFilter
  | ReachFilter
  | SellabilityFilter
  | UsageFilter;

// The pills read bare — the label above the group carries what the
// `Status:`/`Health:` prefix used to say on each one. The deactivated pill is
// re-labelled per list (Devices called a revoked Device "Revoked" before it
// grew its own health pills, record 056 Q5).
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "deactivated", label: "Deactivated" },
];

// The Devices fleet's pills: the same last-seen thresholds as the health dot
// in its Last seen column — green under five minutes, amber under an hour,
// grey after, and a revoked Device is grey too (record 056 Q5).
const HEALTH_FILTERS: { value: HealthFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "online", label: "Online" },
  { value: "stale", label: "Stale" },
  { value: "offline", label: "Offline" },
];

// The Employees roster's pills: role is what the reader hunts for there —
// "who are my admins?" is the access question, where the binary
// active/deactivated lifecycle (already a column badge + sort) earned nothing.
const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "cashier", label: "Cashier" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

// The Payment methods list's pills: whether a cashier can actually take money
// with a method, which is what its Available at column already computes. A
// method active but offered at no store reaches no till — the lifecycle badge
// never shows that, and Deactivated is the same nil reach chosen on purpose.
const REACH_FILTERS: { value: ReachFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "nostores", label: "No stores" },
  { value: "deactivated", label: "Deactivated" },
];

const SELLABILITY_FILTERS: { value: SellabilityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

const USAGE_FILTERS: { value: UsageFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "inuse", label: "In use" },
  { value: "needsattention", label: "Needs attention" },
  { value: "unused", label: "Unused" },
];

const VARIANTS = {
  status: { label: "Status", options: STATUS_FILTERS },
  health: { label: "Health", options: HEALTH_FILTERS },
  role: { label: "Role", options: ROLE_FILTERS },
  reach: { label: "Availability", options: REACH_FILTERS },
  sellability: { label: "Status", options: SELLABILITY_FILTERS },
  usage: { label: "Usage", options: USAGE_FILTERS },
} satisfies Record<string, { label: string; options: { value: ListFilter; label: string }[] }>;

// The list card's own toolbar (record 044 §§1–2): pills left, search right,
// both inside the card so the page header stays title and one action. A
// `children` slot lets a list add its own dimension — Devices drops a Store
// select in beside the pills.
export function ListToolbar<F extends ListFilter>({
  status,
  onStatusChange,
  query,
  onQueryChange,
  searchLabel,
  searchExample,
  deactivatedLabel = "Deactivated",
  variant = "status",
  children,
}: {
  status: F;
  onStatusChange: (status: F) => void;
  query: string;
  onQueryChange: (query: string) => void;
  searchLabel: string;
  searchExample: string;
  deactivatedLabel?: string;
  variant?: keyof typeof VARIANTS;
  children?: ReactNode;
}) {
  const statusId = useId();
  const searchId = useId();
  // Only the status pills rename their deactivated end per list.
  const filters = (
    variant === "status"
      ? VARIANTS.status.options.map((filter) =>
          filter.value === "deactivated" ? { ...filter, label: deactivatedLabel } : filter,
        )
      : VARIANTS[variant].options
  ) as { value: F; label: string }[];

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span id={statusId} className="text-xs font-medium text-muted-foreground">
            {VARIANTS[variant].label}
          </span>
          <div
            role="group"
            aria-labelledby={statusId}
            className="inline-flex h-11 items-center gap-1 rounded-full bg-tab-list p-1"
          >
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                // "Deactivated" alone would shadow a row's `Deactivate <name>`
                // for anything matching by name; the verb keeps them apart.
                aria-label={`Show ${filter.label.toLowerCase()}`}
                aria-pressed={status === filter.value}
                onClick={() => onStatusChange(filter.value)}
                className={cn(
                  "tap-target h-full min-h-0 rounded-full px-4 py-0 text-sm font-medium transition-colors",
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
        {children}
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
