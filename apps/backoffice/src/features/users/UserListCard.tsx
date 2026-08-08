import { useId } from "react";
import {
  EllipsisVerticalIcon,
  PencilIcon,
  PowerOffIcon,
  RotateCcwIcon,
  SearchXIcon,
  UsersIcon,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  EmptyState,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
} from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";
import { initials } from "@/components/helpers.ts";
import type { RoleFilter } from "@/components/ListToolbar.tsx";
import { ListToolbar } from "@/components/ListToolbar.tsx";
import { TablePagination } from "@/components/TablePagination.tsx";
import type { UserListOutput, UserListSortKey, UserOutput } from "./helpers.ts";

const ROLE_LABEL: Record<UserOutput["role"], string> = {
  cashier: "Cashier",
  manager: "Manager",
  admin: "Admin",
};

type SortKey = "name" | "email" | "role" | "status";

function storeNamesFor(storeIds: string[], stores: { id: string; name: string }[]): string {
  const assigned = new Set(storeIds);
  const names = stores.filter((store) => assigned.has(store.id)).map((store) => store.name);
  return names.length > 0 ? names.join(", ") : "None";
}

// The list (record 044 §§1–4, amended by 076): the rows arrive as one server
// page, already filtered, sorted, and paginated by `user.list` — the card
// only renders. A deactivated User stays inline, badged, never hidden or
// dimmed: the Status column is the User's own choice, every User is visible
// by default, and the toolbar filters what the roster's reader hunts for —
// Role (what access they hold) and Store (where they work). Both ride the
// route's URL search params, so the card owns none of the state.
export function UserListCard({
  data,
  stores,
  isPending,
  isError,
  isFetching,
  refetch,
  isAdmin,
  callerId,
  editingId,
  role,
  onRoleChange,
  store,
  onStoreChange,
  query,
  onQueryChange,
  sort,
  onSortChange,
  onPageChange,
  onClearFilters,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  data: UserListOutput | undefined;
  stores: { id: string; name: string }[];
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  isAdmin: boolean;
  callerId: string | undefined;
  editingId: string | null;
  role: RoleFilter;
  onRoleChange: (role: RoleFilter) => void;
  store: string;
  onStoreChange: (store: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  sort: { key: UserListSortKey; direction: "asc" | "desc" };
  onSortChange: (key: UserListSortKey) => void;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
  onEdit: (user: UserOutput) => void;
  onDeactivate: (user: UserOutput) => void;
  onReactivate: (user: UserOutput) => void;
}) {
  const storeLabelId = useId();
  const storeNameById = new Map(stores.map((store) => [store.id, store.name]));

  const users = data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil((data?.count ?? 0) / (data?.perPage ?? 1)));
  const sorted = (key: SortKey) => (sort.key === key ? sort.direction : undefined);

  return (
    <Card className="gap-4">
      <CardContent className="flex flex-col gap-4">
        <ListToolbar
          status={role}
          onStatusChange={onRoleChange}
          variant="role"
          query={query}
          onQueryChange={onQueryChange}
          searchLabel="Search employees"
          searchExample="Juana dela Cruz"
        >
          {/* The Store dimension earns its control only past one store — a
              single-store tenant filters nothing (record 056 Q5's rule). */}
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
        ) : users.length === 0 ? (
          data?.totalCount === 0 ? (
            <EmptyState
              icon={<UsersIcon aria-hidden="true" />}
              title="No employees to show"
              description="Invite someone to give them a back office sign-in and a till PIN."
            />
          ) : (
            <EmptyState
              icon={<SearchXIcon aria-hidden="true" />}
              title="No employees match these filters"
              description="Try another role or store, or clear the search."
              action={
                <Button variant="outline" onClick={onClearFilters}>
                  Clear filters
                </Button>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Employees">
              <TableHeader>
                <TableRow>
                  <TableHead sorted={sorted("name")} onSort={() => onSortChange("name")}>
                    Name
                  </TableHead>
                  <TableHead sorted={sorted("email")} onSort={() => onSortChange("email")}>
                    Email
                  </TableHead>
                  <TableHead sorted={sorted("role")} onSort={() => onSortChange("role")}>
                    Role
                  </TableHead>
                  <TableHead>Stores</TableHead>
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
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    data-state={user.id === editingId ? "selected" : undefined}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
                        >
                          {initials(user.firstName, user.lastName)}
                        </span>
                        <span>{`${user.firstName} ${user.lastName}`.trim() || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {/* The access dot (ADR-0013): colour is spent only on
                            elevated access, so a roster of cashiers stays
                            quiet and the admins scan in one pass down the
                            column. Blue is free — green is already the Active
                            lifecycle badge in the same row. */}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            user.role === "admin" && "bg-status-info-tone",
                            user.role === "manager" && "bg-status-warning-tone",
                            user.role === "cashier" && "bg-muted-foreground/40",
                          )}
                        />
                        {ROLE_LABEL[user.role]}
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(user.storeIds.length === 0 && "text-muted-foreground")}
                    >
                      {storeNamesFor(user.storeIds, stores)}
                    </TableCell>
                    <TableCell>
                      {user.active ? (
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
                              aria-label={`Actions for ${user.email}`}
                            >
                              <EllipsisVerticalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onCloseAutoFocus={(event) => event.preventDefault()}
                          >
                            {user.active ? (
                              <>
                                <DropdownMenuItem onSelect={() => onEdit(user)}>
                                  <PencilIcon />
                                  Edit
                                </DropdownMenuItem>
                                {user.id !== callerId && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onSelect={() => onDeactivate(user)}
                                    >
                                      <PowerOffIcon />
                                      Deactivate
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            ) : (
                              <DropdownMenuItem onSelect={() => onReactivate(user)}>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Showing {((data?.page ?? 1) - 1) * (data?.perPage ?? 1) + 1}–
                {((data?.page ?? 1) - 1) * (data?.perPage ?? 1) + users.length} of{" "}
                {data?.count ?? 0}
              </p>
              <TablePagination
                page={data?.page ?? 1}
                pageCount={pageCount}
                onPageChange={onPageChange}
                label="Employees pages"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
