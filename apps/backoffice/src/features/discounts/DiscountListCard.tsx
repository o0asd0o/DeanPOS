import {
  ArchiveIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  RotateCcwIcon,
  SearchXIcon,
  TagsIcon,
} from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ui";

import { ListToolbar, type StatusFilter } from "@/components/ListToolbar.tsx";
import { TablePagination } from "@/components/TablePagination.tsx";
import type { DiscountOutput, DiscountStatus } from "./helpers.ts";
import { formatValue, matchesSearch, statusOf } from "./helpers.ts";
import { useTableView } from "@/lib/table.ts";

export function DiscountListCard({
  discounts,
  onEdit,
  onArchive,
  onReactivate,
  onCreate,
}: {
  discounts: DiscountOutput[];
  onEdit: (discount: DiscountOutput) => void;
  onArchive: (discount: DiscountOutput) => void;
  onReactivate: (discount: DiscountOutput) => void;
  onCreate: () => void;
}) {
  const { status, q } = useSearch({ from: "/_shell/discounts" });
  const navigate = useNavigate();
  const setSearch = (next: { status: DiscountStatus; q: string }) =>
    navigate({ to: "/discounts", search: next, replace: true });
  const filtered = discounts.filter(
    (discount) => (status === "all" || statusOf(discount) === status) && matchesSearch(discount, q),
  );
  const table = useTableView(
    filtered,
    { name: (discount) => discount.name.toLowerCase() },
    "name",
    `${status}:${q}`,
  );
  if (discounts.length === 0)
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<TagsIcon aria-hidden="true" />}
            title="No discounts configured."
            description="Add one if your shop gives a senior citizen or staff discount."
            action={<Button onClick={() => onCreate()}>+ New discount</Button>}
          />
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <ListToolbar
          status={status === "archived" ? "deactivated" : (status as StatusFilter)}
          deactivatedLabel="Archived"
          onStatusChange={(next) =>
            setSearch({ status: next === "deactivated" ? "archived" : (next as DiscountStatus), q })
          }
          query={q}
          onQueryChange={(next) => setSearch({ status, q: next })}
          searchLabel="Search discounts"
          searchExample="Senior citizen"
        />
        {filtered.length === 0 ? (
          <EmptyState
            icon={<SearchXIcon aria-hidden="true" />}
            title="No discounts match these filters"
            description="Try another status or clear the search."
            action={
              <Button variant="outline" onClick={() => setSearch({ status: "all", q: "" })}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Discounts">
              <TableHeader>
                <TableRow>
                  <TableHead sorted={table.sortedBy("name")} onSort={() => table.sortBy("name")}>
                    Name
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>VAT-exempt</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((discount) => (
                  <TableRow key={discount.id} className="last:!border-b">
                    <TableCell className="font-medium">{discount.name}</TableCell>
                    <TableCell>{discount.type === "percent" ? "Percent" : "Amount"}</TableCell>
                    <TableCell>{formatValue(discount)}</TableCell>
                    <TableCell>{discount.scope === "order" ? "Whole order" : "Per line"}</TableCell>
                    <TableCell>{discount.vatExempt ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      {discount.requiresReference ? discount.referenceLabel : "No"}
                    </TableCell>
                    <TableCell>{discount.requiresOverride ? "Required" : "Not required"}</TableCell>
                    <TableCell>
                      {discount.archivedAt ? (
                        <Badge variant="secondary">Archived</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="tap-target"
                            aria-label={`Actions for ${discount.name}`}
                          >
                            <EllipsisVerticalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onCloseAutoFocus={(event) => event.preventDefault()}
                        >
                          {discount.archivedAt ? (
                            <DropdownMenuItem onSelect={() => onReactivate(discount)}>
                              <RotateCcwIcon />
                              Reactivate
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem onSelect={() => onEdit(discount)}>
                                <PencilIcon />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => onArchive(discount)}
                              >
                                <ArchiveIcon />
                                Archive
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <TablePagination
          page={table.page}
          pageCount={table.pageCount}
          onPageChange={table.setPage}
          label="Discount pages"
          pageSize={table.pageSize}
          itemCount={table.rows.length}
          totalItems={table.totalItems}
        />
      </CardContent>
    </Card>
  );
}
