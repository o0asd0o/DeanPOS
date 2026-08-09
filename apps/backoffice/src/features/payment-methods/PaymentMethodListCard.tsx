import { useId } from "react";
import {
  EllipsisVerticalIcon,
  PencilIcon,
  PowerOffIcon,
  RotateCcwIcon,
  SearchXIcon,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";
import { TableSkeleton } from "@/components/TableSkeleton.tsx";
import type { ReachFilter } from "@/components/ListToolbar.tsx";
import { ListToolbar } from "@/components/ListToolbar.tsx";
import { TablePagination } from "@/components/TablePagination.tsx";
import { useTableView } from "@/lib/table.ts";
import { AvailableAt } from "./AvailableAt.tsx";
import { availableStores, matchesSearch, paymentMethodReach } from "./helpers.ts";
import type { PaymentMethodOutput, Store } from "./helpers.ts";

const KIND_LABEL: Record<PaymentMethodOutput["kind"], string> = {
  cash: "Cash",
  recorded: "Recorded",
};

type SortKey = "name" | "kind" | "availability" | "status";

const SORT_VALUES: Record<SortKey, (method: PaymentMethodOutput) => string | number> = {
  name: (method) => method.name.toLowerCase(),
  kind: (method) => KIND_LABEL[method.kind],
  // The count, not the label: "All stores" and "None" sort as the reach they
  // stand for, so the misconfigured rows gather at one end.
  availability: (method) => (method.kind === "cash" ? Infinity : method.storeIds.length),
  status: (method) => (method.active ? 0 : 1),
};

// The list (record 054 Q2, following 038/044's shape). `cash` never opens the
// editor, is available everywhere unconditionally, and its actions cell reads
// `Always on` — kind is the only branch, never the name. The toolbar filters
// the reach the Available at column already computes (Live / No stores /
// Deactivated) and the Store a method is offered at; lifecycle stays a column.
// All three ride the route's URL search params, so the card owns none of them.
export function PaymentMethodListCard({
  methods,
  stores,
  isPending,
  isError,
  isFetching,
  refetch,
  isAdmin,
  editingId,
  reactivatingId,
  reactivateFailed,
  reach,
  onReachChange,
  store,
  onStoreChange,
  query,
  onQueryChange,
  onClearFilters,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  methods: PaymentMethodOutput[] | undefined;
  stores: Store[];
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  isAdmin: boolean;
  editingId: string | null;
  reactivatingId: string | null;
  reactivateFailed: boolean;
  reach: ReachFilter;
  onReachChange: (reach: ReachFilter) => void;
  store: string;
  onStoreChange: (store: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onClearFilters: () => void;
  onEdit: (method: PaymentMethodOutput) => void;
  onDeactivate: (method: PaymentMethodOutput) => void;
  onReactivate: (method: PaymentMethodOutput) => void;
}) {
  const storeLabelId = useId();
  const term = query.trim().toLowerCase();

  const all = methods ?? [];
  const visible = all.filter(
    (method) =>
      (reach === "all" || paymentMethodReach(method, stores) === reach) &&
      (store === "all" ||
        availableStores(method, stores).some((available) => available.id === store)) &&
      matchesSearch(method, stores, term),
  );

  const table = useTableView(visible, SORT_VALUES, "name");
  const filtered = reach !== "all" || store !== "all" || term !== "";

  return (
    <Card className="gap-4">
      <CardContent className="flex flex-col gap-4">
        <ListToolbar
          status={reach}
          onStatusChange={onReachChange}
          variant="reach"
          query={query}
          onQueryChange={onQueryChange}
          searchLabel="Search methods"
          searchExample="GCash"
        >
          {/* The Store dimension earns its control only past one store — a
              single-store tenant filters nothing (record 056 Q5's rule). */}
          {stores.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <span id={storeLabelId} className="text-xs font-medium text-muted-foreground">
                Store
              </span>
              <Select value={store} onValueChange={onStoreChange}>
                <SelectTrigger aria-labelledby={storeLabelId} className="rounded-full">
                  <SelectValue placeholder="All stores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stores</SelectItem>
                  {stores.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </ListToolbar>
        {reactivateFailed && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t update the payment method
          </div>
        )}
        {isPending ? (
          <TableSkeleton variant="paymentMethods" isAdmin={isAdmin} />
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<SearchXIcon aria-hidden="true" />}
            title="No payment methods match these filters"
            description="Try another filter, or clear the search."
            action={
              filtered && (
                <Button variant="outline" onClick={onClearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Payment methods">
              <TableHeader>
                <TableRow>
                  <TableHead sorted={table.sortedBy("name")} onSort={() => table.sortBy("name")}>
                    Method
                  </TableHead>
                  <TableHead sorted={table.sortedBy("kind")} onSort={() => table.sortBy("kind")}>
                    Kind
                  </TableHead>
                  <TableHead
                    sorted={table.sortedBy("availability")}
                    onSort={() => table.sortBy("availability")}
                  >
                    Available at
                  </TableHead>
                  <TableHead
                    sorted={table.sortedBy("status")}
                    onSort={() => table.sortBy("status")}
                  >
                    Status
                  </TableHead>
                  {isAdmin && (
                    <TableHead className="w-0 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((method) => {
                  const methodReach = paymentMethodReach(method, stores);
                  return (
                    <TableRow
                      key={method.id}
                      className="last:!border-b"
                      data-state={method.id === editingId ? "selected" : undefined}
                    >
                      <TableCell>{method.name}</TableCell>
                      <TableCell>{KIND_LABEL[method.kind]}</TableCell>
                      {/* Colour is spent on the exception only (ADR-0013): a
                          method live at a till reads as plain text, and the one
                          that is active but reaches nowhere carries the badge. */}
                      <TableCell className={cn(methodReach !== "live" && "text-muted-foreground")}>
                        <AvailableAt method={method} stores={stores} />
                      </TableCell>
                      <TableCell>
                        {method.active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Deactivated</Badge>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {method.kind !== "cash" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="tap-target"
                                  aria-label={`Actions for ${method.name}`}
                                >
                                  <EllipsisVerticalIcon />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                onCloseAutoFocus={(event) => event.preventDefault()}
                              >
                                {method.active ? (
                                  <>
                                    <DropdownMenuItem onSelect={() => onEdit(method)}>
                                      <PencilIcon />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onSelect={() => onDeactivate(method)}
                                    >
                                      <PowerOffIcon />
                                      Deactivate
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <DropdownMenuItem
                                    disabled={reactivatingId === method.id}
                                    onSelect={() => onReactivate(method)}
                                  >
                                    <RotateCcwIcon />
                                    Reactivate
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePagination
              page={table.page}
              pageCount={table.pageCount}
              onPageChange={table.setPage}
              label="Payment methods pages"
              pageSize={table.pageSize}
              itemCount={table.rows.length}
              totalItems={table.totalItems}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
