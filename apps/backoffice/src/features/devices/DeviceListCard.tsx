import { useState } from "react";
import { PencilIcon, PowerOffIcon, UserIcon } from "lucide-react";
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
import { useTableView } from "@/lib/table.ts";
import type { DeviceOutput } from "./helpers.ts";
import { relativeLastSeen } from "./helpers.ts";

type SortKey = "name" | "code" | "store" | "lastSeen" | "status";

// The list (record 056 Q5): Device, Code, Store, Last seen, Status, Actions.
// `Revoke` is absent — not disabled — on a revoked row; `Rename` stays,
// because a revoked Device still names past sales.
export function DeviceListCard({
  devices,
  storeNameById,
  isPending,
  isError,
  isFetching,
  refetch,
  isAdmin,
  onRename,
  onRevoke,
  onAssign,
}: {
  devices: DeviceOutput[] | undefined;
  storeNameById: Map<string, string>;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  isAdmin: boolean;
  onRename: (device: DeviceOutput) => void;
  onRevoke: (device: DeviceOutput) => void;
  onAssign: (device: DeviceOutput) => void;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const now = new Date();

  const storeName = (device: DeviceOutput) => storeNameById.get(device.storeId) ?? "";

  const SORT_VALUES: Record<SortKey, (device: DeviceOutput) => string | number> = {
    name: (device) => device.name.toLowerCase(),
    code: (device) => device.code,
    store: (device) => storeName(device).toLowerCase(),
    lastSeen: (device) => device.lastSeenAt.getTime(),
    status: (device) => (device.revokedAt ? 1 : 0),
  };

  const term = query.trim().toLowerCase();
  const visible = (devices ?? []).filter(
    (device) =>
      (status === "all" || (status === "active") === !device.revokedAt) &&
      (term === "" ||
        device.name.toLowerCase().includes(term) ||
        device.code.toLowerCase().includes(term)),
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
          searchLabel="Search devices"
          searchExample="Counter 2"
        />
        {isPending ? (
          <p role="status">Loading…</p>
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : !devices || devices.length === 0 ? (
          <>
            <p className="text-foreground">No devices yet</p>
            {isAdmin && (
              <p className="text-foreground">
                Enrol a terminal to start taking sales at the till. Use Enrol a device above.
              </p>
            )}
          </>
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Devices">
              <TableHeader>
                <TableRow>
                  <TableHead sorted={table.sortedBy("name")} onSort={() => table.sortBy("name")}>
                    Device
                  </TableHead>
                  <TableHead sorted={table.sortedBy("code")} onSort={() => table.sortBy("code")}>
                    Code
                  </TableHead>
                  <TableHead sorted={table.sortedBy("store")} onSort={() => table.sortBy("store")}>
                    Store
                  </TableHead>
                  <TableHead
                    sorted={table.sortedBy("lastSeen")}
                    onSort={() => table.sortBy("lastSeen")}
                  >
                    Last seen
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
                {table.rows.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>{device.name}</TableCell>
                    <TableCell>{device.code}</TableCell>
                    <TableCell>{storeName(device)}</TableCell>
                    <TableCell>
                      <time dateTime={device.lastSeenAt.toISOString()}>
                        {relativeLastSeen(device.lastSeenAt, now)}
                      </time>
                    </TableCell>
                    <TableCell>
                      {device.revokedAt ? (
                        <Badge variant="secondary">Revoked</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="tap-target"
                            aria-label={`Rename ${device.name}`}
                            onClick={() => onRename(device)}
                          >
                            <PencilIcon />
                            Rename
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="tap-target"
                            aria-label={`Restrict ${device.name}`}
                            onClick={() => onAssign(device)}
                          >
                            <UserIcon />
                            {device.assignedUserId ? "Restricted" : "Restrict"}
                          </Button>
                          {!device.revokedAt && (
                            <Button
                              variant="outline"
                              danger
                              size="sm"
                              className="tap-target"
                              aria-label={`Revoke ${device.name}`}
                              onClick={() => onRevoke(device)}
                            >
                              <PowerOffIcon />
                              Revoke
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
                No devices match these filters
              </p>
            )}
            <TablePagination
              page={table.page}
              pageCount={table.pageCount}
              onPageChange={table.setPage}
              label="Devices pages"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
