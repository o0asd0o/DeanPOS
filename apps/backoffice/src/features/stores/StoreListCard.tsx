import {
  EllipsisVerticalIcon,
  PencilIcon,
  PowerOffIcon,
  RotateCcwIcon,
  SearchXIcon,
  StoreIcon,
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
import { TableSkeleton } from "@/components/TableSkeleton.tsx";
import { TablePagination } from "@/components/TablePagination.tsx";
import type { StoreListOutput, StoreListSort, StoreListSortKey, StoreOutput } from "./helpers.ts";

// The list (record 038 §§2–3, 6), in the Users list's shape: the card holds
// the toolbar and the table only, the title and `Add store` sit in the page
// header above it. A deactivated Store stays inline, at full contrast,
// badged, with `Reactivate` as its only row action — never hidden or dimmed.
export function StoreListCard({
  data,
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
  status,
  onStatusChange,
  query,
  onQueryChange,
  sort,
  onSortChange,
  onPageChange,
  onClearFilters,
  openCreate,
}: {
  data: StoreListOutput | undefined;
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
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  sort: StoreListSort;
  onSortChange: (key: StoreListSortKey) => void;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
  openCreate: () => void;
}) {
  const stores = data?.items ?? [];
  const sorted = (key: StoreListSortKey) => (sort.key === key ? sort.direction : undefined);

  return (
    <Card className="gap-4">
      <CardContent className="flex flex-col gap-4">
        <ListToolbar
          status={status}
          onStatusChange={onStatusChange}
          query={query}
          onQueryChange={onQueryChange}
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
          <TableSkeleton variant="stores" isAdmin={isAdmin} />
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : data?.totalCount === 0 ? (
          <EmptyState
            icon={<StoreIcon aria-hidden="true" />}
            title="No stores yet"
            description="A store is one outlet — its own sales, devices, and table labels."
            action={
              isAdmin ? (
                <Button variant="outline" onClick={openCreate}>
                  Add your first store
                </Button>
              ) : undefined
            }
          />
        ) : stores.length === 0 ? (
          <EmptyState
            icon={<SearchXIcon aria-hidden="true" />}
            title="No stores match these filters"
            description="Try another status, or clear the search."
            action={
              <Button variant="outline" onClick={onClearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Stores">
              <TableHeader>
                <TableRow>
                  <TableHead sorted={sorted("name")} onSort={() => onSortChange("name")}>
                    Name
                  </TableHead>
                  <TableHead
                    sorted={sorted("businessDayStart")}
                    onSort={() => onSortChange("businessDayStart")}
                  >
                    Business-day start
                  </TableHead>
                  <TableHead
                    sorted={sorted("tableLabels")}
                    onSort={() => onSortChange("tableLabels")}
                  >
                    Table labels
                  </TableHead>
                  <TableHead sorted={sorted("status")} onSort={() => onSortChange("status")}>
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
                {stores.map((store) => (
                  <TableRow
                    key={store.id}
                    className="last:!border-b"
                    data-state={store.id === editingId ? "selected" : undefined}
                  >
                    <TableCell className="font-medium">{store.name}</TableCell>
                    <TableCell>
                      {store.businessDayStart}{" "}
                      <span className="text-muted-foreground">
                        –{" "}
                        {(() => {
                          const [h, m] = store.businessDayStart.split(":").map(Number);
                          const end = (h * 60 + m + 1439) % 1440;
                          return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
                        })()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {store.tableLabels.length === 0 ? (
                        <span className="text-muted-foreground">None</span>
                      ) : (
                        <>
                          {store.tableLabels.slice(0, 3).join(" · ")}
                          {store.tableLabels.length > 3 && (
                            <span className="text-muted-foreground">
                              {" "}
                              · +{store.tableLabels.length - 3}
                            </span>
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      {store.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Deactivated</Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="tap-target"
                              aria-label={`Actions for ${store.name}`}
                            >
                              <EllipsisVerticalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onCloseAutoFocus={(event) => event.preventDefault()}
                          >
                            {store.active ? (
                              <>
                                <DropdownMenuItem onSelect={() => onEdit(store)}>
                                  <PencilIcon />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() => onDeactivate(store)}
                                >
                                  <PowerOffIcon />
                                  Deactivate
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem
                                disabled={reactivatingId === store.id}
                                onSelect={() => onReactivate(store)}
                              >
                                <RotateCcwIcon />
                                Reactivate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={data?.page ?? 1}
              pageCount={Math.max(1, Math.ceil((data?.count ?? 0) / (data?.perPage ?? 10)))}
              onPageChange={onPageChange}
              label="Stores pages"
              pageSize={data?.perPage ?? 10}
              itemCount={stores.length}
              totalItems={data?.count ?? 0}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
