import { useState } from "react";
import { PencilIcon, PowerOffIcon, RotateCcwIcon, SearchXIcon, StoreIcon } from "lucide-react";
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
import type { StoreOutput } from "./helpers.ts";

type SortKey = "name" | "businessDayStart" | "tableLabels" | "status";

const SORT_VALUES: Record<SortKey, (store: StoreOutput) => string | number> = {
  name: (store) => store.name.toLowerCase(),
  businessDayStart: (store) => store.businessDayStart,
  tableLabels: (store) => store.tableLabels.length,
  status: (store) => (store.active ? 0 : 1),
};

// The list (record 038 §§2–3, 6), in the Users list's shape: the card holds
// the toolbar and the table only, the title and `Add store` sit in the page
// header above it. A deactivated Store stays inline, at full contrast,
// badged, with `Reactivate` as its only row action — never hidden or dimmed.
export function StoreListCard({
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
  stores: StoreOutput[] | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  isAdmin: boolean;
  editingId: string | null;
  reactivatingId: string | null;
  reactivateFailed: boolean;
  onEdit: (store: StoreOutput) => void;
  onDeactivate: (store: StoreOutput) => void;
  onReactivate: (store: StoreOutput) => void;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const term = query.trim().toLowerCase();
  const visible = (stores ?? []).filter(
    (store) =>
      (status === "all" || (status === "active") === store.active) &&
      (term === "" || store.name.toLowerCase().includes(term)),
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
          searchLabel="Search stores"
          searchExample="Downtown"
        />
        {reactivateFailed && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t update the store
          </div>
        )}
        {isPending ? (
          <p role="status">Loading…</p>
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : !stores || stores.length === 0 ? (
          <EmptyState
            icon={<StoreIcon aria-hidden="true" />}
            title="No stores yet"
            description={
              isAdmin &&
              "A store is one outlet — its own sales, its own devices, and its own table labels. Use Add store above to create the first one."
            }
          />
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Stores">
              <TableHeader>
                <TableRow>
                  <TableHead sorted={table.sortedBy("name")} onSort={() => table.sortBy("name")}>
                    Name
                  </TableHead>
                  <TableHead
                    sorted={table.sortedBy("businessDayStart")}
                    onSort={() => table.sortBy("businessDayStart")}
                  >
                    Business-day start
                  </TableHead>
                  <TableHead
                    sorted={table.sortedBy("tableLabels")}
                    onSort={() => table.sortBy("tableLabels")}
                  >
                    Table labels
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
                {table.rows.map((store) => (
                  <TableRow
                    key={store.id}
                    data-state={store.id === editingId ? "selected" : undefined}
                  >
                    <TableCell>{store.name}</TableCell>
                    <TableCell>{store.businessDayStart}</TableCell>
                    <TableCell>{store.tableLabels.length || "None"}</TableCell>
                    <TableCell>
                      {store.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Deactivated</Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {store.active && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="tap-target"
                                aria-label={`Edit ${store.name}`}
                                onClick={() => onEdit(store)}
                              >
                                <PencilIcon />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                danger
                                size="sm"
                                className="tap-target"
                                aria-label={`Deactivate ${store.name}`}
                                onClick={() => onDeactivate(store)}
                              >
                                <PowerOffIcon />
                                Deactivate
                              </Button>
                            </>
                          )}
                          {!store.active && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="tap-target"
                              aria-label={`Reactivate ${store.name}`}
                              aria-disabled={reactivatingId === store.id}
                              onClick={() => onReactivate(store)}
                            >
                              <RotateCcwIcon />
                              Reactivate
                            </Button>
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
                title="No stores match these filters"
                description="Try another status, or clear the search."
              />
            )}
            <TablePagination
              page={table.page}
              pageCount={table.pageCount}
              onPageChange={table.setPage}
              label="Stores pages"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
