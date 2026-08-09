import { SearchXIcon } from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
} from "ui";
import { ArchiveIcon, EllipsisVerticalIcon, PencilIcon, RotateCcwIcon } from "lucide-react";
import { ErrorState } from "@/components/ErrorState.tsx";
import { TablePagination } from "@/components/TablePagination.tsx";
import { TableSkeleton } from "@/components/TableSkeleton.tsx";
import type { UsageFilter } from "@/components/ListToolbar.tsx";
import { ListToolbar } from "@/components/ListToolbar.tsx";
import {
  formatDelta,
  getAddOnSignals,
  type AddOnOutput,
  type OptionListPage,
  type OptionListSort,
} from "./helpers.ts";

export function AddOnListCard({
  data,
  isPending,
  isError,
  isFetching,
  refetch,
  canMutate,
  onEdit,
  onArchive,
  onReactivate,
}: {
  data: OptionListPage<AddOnOutput> | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  canMutate: boolean;
  onEdit: (addOn: AddOnOutput) => void;
  onArchive: (addOn: AddOnOutput) => void;
  onReactivate: (addOn: AddOnOutput) => void;
}) {
  const { usage: status, q: query, page, sort } = useSearch({ from: "/_shell/add-ons" });
  const navigate = useNavigate();
  const setSearch = (next: { usage: UsageFilter; q: string }) =>
    navigate({ to: "/add-ons", search: { ...next, page: 1, sort }, replace: true });
  const setPage = (nextPage: number) =>
    navigate({
      to: "/add-ons",
      search: { usage: status, q: query, page: nextPage, sort },
      replace: true,
    });
  const setSort = (key: OptionListSort["key"]) =>
    navigate({
      to: "/add-ons",
      search: {
        usage: status,
        q: query,
        page: 1,
        sort:
          sort.key === key
            ? { key, direction: sort.direction === "asc" ? "desc" : "asc" }
            : { key, direction: "asc" },
      },
      replace: true,
    });
  const term = query.trim().toLowerCase();
  const rows = data?.items ?? [];
  const hasFilters = status !== "all" || term !== "";
  return (
    <Card className="gap-4">
      <CardContent className="flex flex-col gap-4">
        <ListToolbar
          status={status}
          onStatusChange={(next) => setSearch({ usage: next, q: query })}
          query={query}
          onQueryChange={(next) => setSearch({ usage: status, q: next })}
          searchLabel="Search add-ons"
          searchExample="Extra rice"
          variant="usage"
        />
        {isPending ? (
          <TableSkeleton variant="modifierGroups" />
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={<SearchXIcon aria-hidden="true" />}
              title="No add-ons match these filters"
              description="Try another usage or clear the search."
              action={
                <Button variant="outline" onClick={() => setSearch({ usage: "all", q: "" })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">No add-ons yet.</p>
          )
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Add-ons">
              <TableHeader>
                <TableRow>
                  <TableHead
                    sorted={sort.key === "name" ? sort.direction : undefined}
                    onSort={() => setSort("name")}
                  >
                    Add-on
                  </TableHead>
                  <TableHead
                    sorted={sort.key === "delta" ? sort.direction : undefined}
                    onSort={() => setSort("delta")}
                  >
                    Delta type
                  </TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead
                    sorted={sort.key === "maximum" ? sort.direction : undefined}
                    onSort={() => setSort("maximum")}
                  >
                    Max qty
                  </TableHead>
                  <TableHead
                    sorted={sort.key === "linked" ? sort.direction : undefined}
                    onSort={() => setSort("linked")}
                  >
                    Linked variants
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((addOn) => (
                  <TableRow key={addOn.id}>
                    <TableCell className="font-medium">
                      {addOn.name}
                      {getAddOnSignals(addOn).unused ? (
                        <span className="ml-2 text-status-warning-foreground">Offered nowhere</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {addOn.delta.kind === "absolute" ? "Absolute" : "Multiplier"}
                    </TableCell>
                    <TableCell>{formatDelta(addOn.delta)}</TableCell>
                    <TableCell>{addOn.maximum ?? "Unlimited"}</TableCell>
                    <TableCell>{addOn.linkedToCount}</TableCell>
                    <TableCell className="text-right">
                      {canMutate ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="tap-target"
                              aria-label={`Actions for ${addOn.name}`}
                            >
                              <EllipsisVerticalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onCloseAutoFocus={(event) => event.preventDefault()}
                          >
                            {addOn.archivedAt ? (
                              <DropdownMenuItem onSelect={() => onReactivate(addOn)}>
                                <RotateCcwIcon />
                                Reactivate
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem onSelect={() => onEdit(addOn)}>
                                  <PencilIcon />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() => onArchive(addOn)}
                                >
                                  <ArchiveIcon />
                                  Archive
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={page}
              pageCount={Math.max(1, Math.ceil((data?.count ?? 0) / (data?.perPage ?? 10)))}
              onPageChange={setPage}
              label="Add-ons pages"
              pageSize={data?.perPage ?? 10}
              itemCount={rows.length}
              totalItems={data?.count ?? 0}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
