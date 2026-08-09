import { useId } from "react";
import {
  EllipsisVerticalIcon,
  MonitorSmartphoneIcon,
  PencilIcon,
  PowerOffIcon,
  SearchXIcon,
  UserRoundIcon,
  UsersRoundIcon,
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
import type { HealthFilter } from "@/components/ListToolbar.tsx";
import { ListToolbar } from "@/components/ListToolbar.tsx";
import { TablePagination } from "@/components/TablePagination.tsx";
import type { DeviceListOutput, DeviceListSortKey, DeviceOutput } from "./helpers.ts";
import { deviceHealthColor, relativeLastSeen } from "./helpers.ts";
import useGetDeviceName from "./__hooks/useGetDeviceName.ts";

// The list (record 056 Q5): Device (name + short code), Store, Assigned to,
// Last seen, Status, Actions — six columns. The rows arrive as one server
// page, already filtered, sorted, and paginated by `device.list`; the card
// only renders. Assignment is a plain read here (open to all or one
// employee); both it and the name are edited in the `⋯` menu's Edit sheet in
// one call. Revoke is only on a live row — a revoked Device still names past
// sales, so Edit stays (Revoke is absent, not disabled).
export function DeviceListCard({
  data,
  storeNameById,
  userNameById,
  isPending,
  isError,
  isFetching,
  refetch,
  isAdmin,
  health,
  onHealthChange,
  store,
  onStoreChange,
  query,
  onQueryChange,
  sort,
  onSortChange,
  onPageChange,
  onEdit,
  onRevoke,
}: {
  data: DeviceListOutput | undefined;
  storeNameById: Map<string, string>;
  userNameById: Map<string, string>;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  isAdmin: boolean;
  health: HealthFilter;
  onHealthChange: (health: HealthFilter) => void;
  store: string;
  onStoreChange: (store: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  sort: { key: DeviceListSortKey; direction: "asc" | "desc" };
  onSortChange: (key: DeviceListSortKey) => void;
  onPageChange: (page: number) => void;
  onEdit: (device: DeviceOutput) => void;
  onRevoke: (device: DeviceOutput) => void;
}) {
  const storeLabelId = useId();
  const now = new Date();

  const getName = useGetDeviceName({ storeNameById, userNameById });

  const devices = data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil((data?.count ?? 0) / (data?.perPage ?? 1)));
  const sorted = (key: DeviceListSortKey) => (sort.key === key ? sort.direction : undefined);

  return (
    <Card className="gap-4">
      <CardContent className="flex flex-col gap-4">
        <ListToolbar
          status={health}
          onStatusChange={onHealthChange}
          variant="health"
          query={query}
          onQueryChange={onQueryChange}
          searchLabel="Search devices"
          searchExample="Counter 2"
        >
          {/* The Store dimension earns its control only past one store — a
              single-store tenant filters nothing (record 056 Q5). */}
          {storeNameById.size > 1 && (
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
                  {[...storeNameById.entries()].map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </ListToolbar>
        {isPending ? (
          <p role="status">Loading…</p>
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : devices.length === 0 ? (
          data?.totalCount === 0 ? (
            <EmptyState
              icon={<MonitorSmartphoneIcon aria-hidden="true" />}
              title="No devices yet"
              description={
                isAdmin &&
                "Enrol a terminal to start taking sales at the till. Use Enrol a device above."
              }
            />
          ) : (
            <EmptyState
              icon={<SearchXIcon aria-hidden="true" />}
              title="No devices match these filters"
              description="Try another filter, or clear the search."
            />
          )
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Devices">
              <TableHeader>
                <TableRow>
                  <TableHead sorted={sorted("name")} onSort={() => onSortChange("name")}>
                    Device
                  </TableHead>
                  <TableHead sorted={sorted("store")} onSort={() => onSortChange("store")}>
                    Store
                  </TableHead>
                  <TableHead
                    sorted={sorted("assignedTo")}
                    onSort={() => onSortChange("assignedTo")}
                  >
                    Assigned to
                  </TableHead>
                  <TableHead sorted={sorted("lastSeen")} onSort={() => onSortChange("lastSeen")}>
                    Last seen
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
                {devices.map((device) => {
                  const health = deviceHealthColor(
                    device.lastSeenAt,
                    now,
                    device.revokedAt !== null,
                  );
                  return (
                    <TableRow key={device.id} className="last:!border-b">
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{device.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {device.code}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getName(device, "storeName")}</TableCell>
                      <TableCell
                        className={cn(!getName(device, "userName") && "text-muted-foreground")}
                      >
                        <div className="flex items-center gap-2">
                          {getName(device, "userName") ? (
                            <UserRoundIcon aria-hidden="true" className="size-4 shrink-0" />
                          ) : (
                            <UsersRoundIcon aria-hidden="true" className="size-4 shrink-0" />
                          )}
                          <span>{getName(device, "userName") || "Open to all"}</span>
                        </div>
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
                              onCloseAutoFocus={(event) => event.preventDefault()}
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
            <TablePagination
              // The server clamps an out-of-range page; show the page it
              // actually served, not the stale URL value.
              page={data?.page ?? 1}
              pageCount={pageCount}
              onPageChange={onPageChange}
              label="Devices pages"
              pageSize={data?.perPage ?? 1}
              itemCount={data?.items.length ?? 0}
              totalItems={data?.count ?? 0}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
