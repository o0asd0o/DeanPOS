import { useState } from "react";
import {
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
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";
import type { StatusFilter } from "@/components/ListToolbar.tsx";
import { ListToolbar } from "@/components/ListToolbar.tsx";
import { TablePagination } from "@/components/TablePagination.tsx";
import { useTableView } from "@/lib/table.ts";
import { availableAtLabel } from "./helpers.ts";
import type { PaymentMethodOutput } from "./helpers.ts";

const KIND_LABEL: Record<PaymentMethodOutput["kind"], string> = {
  cash: "Cash",
  recorded: "Recorded",
};

type SortKey = "name" | "kind" | "status";

const SORT_VALUES: Record<
  SortKey,
  (method: PaymentMethodOutput) => string | number
> = {
  name: (method) => method.name.toLowerCase(),
  kind: (method) => KIND_LABEL[method.kind],
  status: (method) => (method.active ? 0 : 1),
};

// The list (record 054 Q2, following 038/044's shape). `cash` never opens
// the editor, is available everywhere unconditionally, and its actions cell
// reads `Always on` — kind is the only branch, never the name.
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
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  methods: PaymentMethodOutput[] | undefined;
  stores: { id: string; name: string }[];
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  isAdmin: boolean;
  editingId: string | null;
  reactivatingId: string | null;
  reactivateFailed: boolean;
  onEdit: (method: PaymentMethodOutput) => void;
  onDeactivate: (method: PaymentMethodOutput) => void;
  onReactivate: (method: PaymentMethodOutput) => void;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const term = query.trim().toLowerCase();
  const visible = (methods ?? []).filter(
    (method) =>
      (status === "all" || (status === "active") === method.active) &&
      (term === "" || method.name.toLowerCase().includes(term)),
  );

  const table = useTableView(visible, SORT_VALUES, "name");

  return (
    <Card className="gap-4">
      <CardContent className="flex flex-col gap-4">
        <ListToolbar
          status={status}
          onStatusChange={setStatus}
          query={query}
          onQueryChange={setQuery}
          searchLabel="Search methods"
          searchExample="GCash"
        />
        {reactivateFailed && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t update the payment method
          </div>
        )}
        {isPending ? (
          <p role="status">Loading…</p>
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Payment methods">
              <TableHeader>
                <TableRow>
                  <TableHead
                    sorted={table.sortedBy("name")}
                    onSort={() => table.sortBy("name")}
                  >
                    Method
                  </TableHead>
                  <TableHead
                    sorted={table.sortedBy("kind")}
                    onSort={() => table.sortBy("kind")}
                  >
                    Kind
                  </TableHead>
                  <TableHead>Available at</TableHead>
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
                {table.rows.map((method) => (
                  <TableRow
                    key={method.id}
                    data-state={
                      method.id === editingId ? "selected" : undefined
                    }
                  >
                    <TableCell>{method.name}</TableCell>
                    <TableCell>{KIND_LABEL[method.kind]}</TableCell>
                    <TableCell>
                      {method.kind === "cash"
                        ? "All stores"
                        : availableAtLabel(method.storeIds, stores)}
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
                        <div className="flex justify-end gap-1">
                          {method.kind === "cash" ? (
                            <span className="text-sm text-muted-foreground">
                              Always on
                            </span>
                          ) : (
                            <>
                              {method.active && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="tap-target"
                                    aria-label={`Edit ${method.name}`}
                                    onClick={() => onEdit(method)}
                                  >
                                    <PencilIcon />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    danger
                                    size="sm"
                                    className="tap-target"
                                    aria-label={`Deactivate ${method.name}`}
                                    onClick={() => onDeactivate(method)}
                                  >
                                    <PowerOffIcon />
                                    Deactivate
                                  </Button>
                                </>
                              )}
                              {!method.active && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="tap-target"
                                  aria-label={`Reactivate ${method.name}`}
                                  aria-disabled={reactivatingId === method.id}
                                  onClick={() => onReactivate(method)}
                                >
                                  <RotateCcwIcon />
                                  Reactivate
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {visible.length === 0 && (
              <EmptyState
                icon={<SearchXIcon aria-hidden="true" />}
                title="No payment methods match these filters"
                description="Try another status, or clear the search."
              />
            )}
            <TablePagination
              page={table.page}
              pageCount={table.pageCount}
              onPageChange={table.setPage}
              label="Payment methods pages"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
