import { ShieldCheckIcon } from "lucide-react";
import {
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
import { TablePagination } from "@/components/TablePagination.tsx";
import { useTableView } from "@/lib/table.ts";
import { ACTION_TYPE_LABEL } from "./helpers.ts";
import type { OverrideOutput } from "./helpers.ts";

type SortKey = "when" | "store" | "action" | "approver";

const SORT_VALUES: Record<SortKey, (row: OverrideOutput) => string | number> = {
  when: (row) => row.approvedAt.getTime(),
  store: (row) => row.storeName.toLowerCase(),
  action: (row) => ACTION_TYPE_LABEL[row.actionType],
  approver: (row) => row.approverName.toLowerCase(),
};

// The Override review list (issue 12, record 060 Q5). No `Actions` column
// and no `ListToolbar` — an append-only table has nothing to edit or filter.
// Tenant/Store scoping (criterion 8) lives in list-overrides.ts, not here.
export function OverrideListCard({
  overrides,
  isPending,
  isError,
  isFetching,
  refetch,
}: {
  overrides: OverrideOutput[] | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
}) {
  const table = useTableView(overrides ?? [], SORT_VALUES, "when");

  return (
    <Card className="gap-4">
      <CardContent className="flex flex-col gap-4">
        {isPending ? (
          <p role="status">Loading…</p>
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : !overrides || overrides.length === 0 ? (
          <EmptyState
            icon={<ShieldCheckIcon aria-hidden="true" />}
            title="No overrides to show"
            description="Manager approvals taken at the till land here — voids, refunds, price overrides and drawer variances."
          />
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Overrides">
              <TableHeader>
                <TableRow>
                  <TableHead sorted={table.sortedBy("when")} onSort={() => table.sortBy("when")}>
                    When
                  </TableHead>
                  <TableHead sorted={table.sortedBy("store")} onSort={() => table.sortBy("store")}>
                    Store
                  </TableHead>
                  <TableHead
                    sorted={table.sortedBy("action")}
                    onSort={() => table.sortBy("action")}
                  >
                    Action
                  </TableHead>
                  <TableHead
                    sorted={table.sortedBy("approver")}
                    onSort={() => table.sortBy("approver")}
                  >
                    Approved by
                  </TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.approvedAt.toLocaleString()}</TableCell>
                    <TableCell>{row.storeName}</TableCell>
                    <TableCell>{ACTION_TYPE_LABEL[row.actionType]}</TableCell>
                    <TableCell>{row.approverName}</TableCell>
                    <TableCell>{row.reason}</TableCell>
                    <TableCell>{row.deviceName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={table.page}
              pageCount={table.pageCount}
              onPageChange={table.setPage}
              label="Overrides pages"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
