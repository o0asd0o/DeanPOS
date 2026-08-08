import { useState } from "react";
import {
  EllipsisVerticalIcon,
  MonitorSmartphoneIcon,
  PencilIcon,
  PowerOffIcon,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";
import type { StatusFilter } from "@/components/ListToolbar.tsx";
import { ListToolbar } from "@/components/ListToolbar.tsx";
import { TablePagination } from "@/components/TablePagination.tsx";
import { useTableView } from "@/lib/table.ts";
import type { DeviceOutput } from "./helpers.ts";
import { deviceHealthColor, relativeLastSeen } from "./helpers.ts";

type SortKey = "name" | "store" | "assignedTo" | "lastSeen" | "status";

// The list (record 056 Q5): Device (name + short code), Store, Assigned to,
// Last seen, Status, Actions — six columns. Assignment is a plain read here
// (open to all or one employee); both it and the name are edited in the `⋯`
// menu's Edit sheet in one call. Revoke is only on a live row — a revoked
// Device still names past sales, so Edit stays (Revoke is absent, not
// disabled).
export function DeviceListCard({
  devices,
  storeNameById,
  userNameById,
  isPending,
  isError,
  isFetching,
  refetch,
  isAdmin,
  onEdit,
  onRevoke,
}: {
  devices: DeviceOutput[] | undefined;
  storeNameById: Map<string, string>;
  userNameById: Map<string, string>;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  isAdmin: boolean;
  onEdit: (device: DeviceOutput) => void;
  onRevoke: (device: DeviceOutput) => void;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const now = new Date();

  const storeName = (device: DeviceOutput) =>
    storeNameById.get(device.storeId) ?? "";
  const userName = (device: DeviceOutput) =>
    device.assignedUserId
      ? (userNameById.get(device.assignedUserId) ?? "")
      : "";

  const SORT_VALUES: Record<
    SortKey,
    (device: DeviceOutput) => string | number
  > = {
    name: (device) => device.name.toLowerCase(),
    store: (device) => storeName(device).toLowerCase(),
    assignedTo: (device) => userName(device).toLowerCase(),
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
          deactivatedLabel="Revoked"
        />
        {isPending ? (
          <p role="status">Loading…</p>
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : !devices || devices.length === 0 ? (
          <EmptyState
            icon={<MonitorSmartphoneIcon aria-hidden="true" />}
            title="No devices yet"
            description={
              isAdmin &&
              "Enrol a terminal to start taking sales at the till. Use Enrol a device above."
            }
          />
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Devices">
              <TableHeader>
                <TableRow>
                  <TableHead
                    sorted={table.sortedBy("name")}
                    onSort={() => table.sortBy("name")}
                  >
                    Device
                  </TableHead>
                  <TableHead
                    sorted={table.sortedBy("store")}
                    onSort={() => table.sortBy("store")}
                  >
                    Store
                  </TableHead>
                  <TableHead
                    sorted={table.sortedBy("assignedTo")}
                    onSort={() => table.sortBy("assignedTo")}
                  >
                    Assigned to
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
                {table.rows.map((device) => {
                  const health = deviceHealthColor(
                    device.lastSeenAt,
                    now,
                    device.revokedAt !== null,
                  );
                  return (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{device.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {device.code}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{storeName(device)}</TableCell>
                      <TableCell
                        className={cn(
                          !userName(device) && "text-muted-foreground",
                        )}
                      >
                        {userName(device) || "Open to all"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              health === "green" && "bg-status-success-tone",
                              health === "amber" && "bg-status-warning-tone",
                              health === "grey" && "bg-muted-foreground/40",
                            )}
                          />
                          <time dateTime={device.lastSeenAt.toISOString()}>
                            {relativeLastSeen(device.lastSeenAt, now)}
                          </time>
                        </div>
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="tap-target"
                                aria-label={`Actions for ${device.name}`}
                              >
                                <EllipsisVerticalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              // Every menu item hands off to a dialog/sheet, whose
                              // own focus scope takes over; restoring focus to
                              // the `⋯` trigger here would steal it back out of
                              // the sheet (its Name field holds it by then), so
                              // the menu hands off without taking it back
                              // (record 008).
                              onCloseAutoFocus={(event) =>
                                event.preventDefault()
                              }
                            >
                              <DropdownMenuItem onSelect={() => onEdit(device)}>
                                <PencilIcon />
                                Edit
                              </DropdownMenuItem>
                              {!device.revokedAt && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onSelect={() => onRevoke(device)}
                                  >
                                    <PowerOffIcon />
                                    Revoke
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {visible.length === 0 && (
              <EmptyState
                icon={<SearchXIcon aria-hidden="true" />}
                title="No devices match these filters"
                description="Try another status, or clear the search."
              />
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
