import { useId } from "react";
import { PencilIcon, PowerOffIcon, RotateCcwIcon, SearchXIcon, UsersIcon } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
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
} from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";
import type { RoleFilter } from "@/components/ListToolbar.tsx";
import { ListToolbar } from "@/components/ListToolbar.tsx";
import { TablePagination } from "@/components/TablePagination.tsx";
import { useTableView } from "@/lib/table.ts";
import type { UserOutput } from "./helpers.ts";

const ROLE_LABEL: Record<UserOutput["role"], string> = {
  cashier: "Cashier",
  manager: "Manager",
  admin: "Admin",
};

type SortKey = "name" | "email" | "role" | "status";

const SORT_VALUES: Record<SortKey, (user: UserOutput) => string | number> = {
  name: (user) => `${user.firstName} ${user.lastName}`.trim().toLowerCase(),
  email: (user) => user.email.toLowerCase(),
  role: (user) => ROLE_LABEL[user.role],
  status: (user) => (user.active ? 0 : 1),
};

function storeNamesFor(storeIds: string[], stores: { id: string; name: string }[]): string {
  const assigned = new Set(storeIds);
  const names = stores.filter((store) => assigned.has(store.id)).map((store) => store.name);
  return names.length > 0 ? names.join(", ") : "None";
}

// The list (record 044 §§1–4). A deactivated User stays inline, badged,
// never hidden or dimmed — the Status column is the User's own choice, and
// every User is visible by default so nobody disappears unasked. The toolbar
// filters on what the roster's reader hunts for — Role (what access they
// hold) and Store (where they work) — not the lifecycle boolean, which is
// already a column badge and a sort. Both ride the route's URL search params,
// so the card owns none of the state.
export function UserListCard({
  users,
  stores,
  isPending,
  isError,
  isFetching,
  refetch,
  isAdmin,
  callerId,
  editingId,
  reactivatingId,
  reactivateFailed,
  role,
  onRoleChange,
  store,
  onStoreChange,
  query,
  onQueryChange,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  users: UserOutput[] | undefined;
  stores: { id: string; name: string }[];
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  isAdmin: boolean;
  callerId: string | undefined;
  editingId: string | null;
  reactivatingId: string | null;
  reactivateFailed: boolean;
  role: RoleFilter;
  onRoleChange: (role: RoleFilter) => void;
  store: string;
  onStoreChange: (store: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onEdit: (user: UserOutput) => void;
  onDeactivate: (user: UserOutput) => void;
  onReactivate: (user: UserOutput) => void;
}) {
  const storeLabelId = useId();
  const storeNameById = new Map(stores.map((store) => [store.id, store.name]));

  const term = query.trim().toLowerCase();
  const visible = (users ?? []).filter(
    (user) =>
      (role === "all" || user.role === role) &&
      (store === "all" || user.storeIds.includes(store)) &&
      // Name, email, and the stores they work at: the field asks for a
      // person or a place, and the list carries both.
      (term === "" ||
        user.email.toLowerCase().includes(term) ||
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(term) ||
        storeNamesFor(user.storeIds, stores).toLowerCase().includes(term)),
  );

  const table = useTableView(visible, SORT_VALUES, "name");

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
        {reactivateFailed && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t update the user
          </div>
        )}
        {isPending ? (
          <p role="status">Loading…</p>
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : !users || users.length === 0 ? (
          <EmptyState
            icon={<UsersIcon aria-hidden="true" />}
            title="No employees to show"
            description="Invite someone to give them a back office sign-in and a till PIN."
          />
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Employees">
              <TableHeader>
                <TableRow>
                  <TableHead sorted={table.sortedBy("name")} onSort={() => table.sortBy("name")}>
                    Name
                  </TableHead>
                  <TableHead sorted={table.sortedBy("email")} onSort={() => table.sortBy("email")}>
                    Email
                  </TableHead>
                  <TableHead sorted={table.sortedBy("role")} onSort={() => table.sortBy("role")}>
                    Role
                  </TableHead>
                  <TableHead>Stores</TableHead>
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
                {table.rows.map((user) => (
                  <TableRow
                    key={user.id}
                    data-state={user.id === editingId ? "selected" : undefined}
                  >
                    <TableCell>{`${user.firstName} ${user.lastName}`.trim() || "—"}</TableCell>
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
                    <TableCell>{storeNamesFor(user.storeIds, stores)}</TableCell>
                    <TableCell>
                      {user.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Deactivated</Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {user.active && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="tap-target"
                                aria-label={`Edit ${user.email}`}
                                onClick={() => onEdit(user)}
                              >
                                <PencilIcon />
                                Edit
                              </Button>
                              {user.id !== callerId && (
                                <Button
                                  variant="outline"
                                  danger
                                  size="sm"
                                  className="tap-target"
                                  aria-label={`Deactivate ${user.email}`}
                                  onClick={() => onDeactivate(user)}
                                >
                                  <PowerOffIcon />
                                  Deactivate
                                </Button>
                              )}
                            </>
                          )}
                          {!user.active && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="tap-target"
                              aria-label={`Reactivate ${user.email}`}
                              aria-disabled={reactivatingId === user.id}
                              onClick={() => onReactivate(user)}
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
                title="No employees match these filters"
                description="Try another role or store, or clear the search."
              />
            )}
            <TablePagination
              page={table.page}
              pageCount={table.pageCount}
              onPageChange={table.setPage}
              label="Employees pages"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
