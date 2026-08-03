import { useState } from "react";
import { PencilIcon, PowerOffIcon, RotateCcwIcon } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
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
import type { SortState } from "@/lib/table.ts";
import { nextSort, PAGE_SIZE, sortRows } from "@/lib/table.ts";
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

  const [sort, setSort] = useState<SortState<SortKey>>({ key: "name", direction: "asc" });
  const [page, setPage] = useState(1);

  const term = query.trim().toLowerCase();
  const visible = (stores ?? []).filter(
    (store) =>
      (status === "all" || (status === "active") === store.active) &&
      (term === "" || store.name.toLowerCase().includes(term)),
  );

  const sorted = sortRows(visible, SORT_VALUES[sort.key], sort.direction);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // Clamped rather than reset: a filter that shortens the list must not strand
  // the reader on a page that no longer exists.
  const current = Math.min(page, pageCount);
  const rows = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const sortBy = (key: SortKey) => {
    setSort(nextSort(sort, key));
    setPage(1);
  };

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
          <>
            <p className="text-foreground">No stores yet</p>
            {isAdmin && (
              <p className="text-foreground">
                A store is one outlet — its own sales, its own devices, and its own table labels.
                Use Add store above to create the first one.
              </p>
            )}
          </>
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Stores">
              <TableHeader>
                <TableRow>
                  <TableHead
                    sorted={sort.key === "name" ? sort.direction : undefined}
                    onSort={() => sortBy("name")}
                  >
                    Name
                  </TableHead>
                  <TableHead
                    sorted={sort.key === "businessDayStart" ? sort.direction : undefined}
                    onSort={() => sortBy("businessDayStart")}
                  >
                    Business-day start
                  </TableHead>
                  <TableHead
                    sorted={sort.key === "tableLabels" ? sort.direction : undefined}
                    onSort={() => sortBy("tableLabels")}
                  >
                    Table labels
                  </TableHead>
                  <TableHead
                    sorted={sort.key === "status" ? sort.direction : undefined}
                    onSort={() => sortBy("status")}
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
                {rows.map((store) => (
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
              <p role="status" className="py-6 text-center text-muted-foreground">
                No stores match these filters
              </p>
            )}
            <TablePagination
              page={current}
              pageCount={pageCount}
              onPageChange={setPage}
              label="Stores pages"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
