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
// never hidden or dimmed — the status filter is the User's own choice, and
// `Status: All` is the default so nobody disappears unasked.
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
  onEdit: (user: UserOutput) => void;
  onDeactivate: (user: UserOutput) => void;
  onReactivate: (user: UserOutput) => void;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const term = query.trim().toLowerCase();
  const visible = (users ?? []).filter(
    (user) =>
      (status === "all" || (status === "active") === user.active) &&
      // Name as well as email: the field asks for a person, and the list now
      // carries one.
      (term === "" ||
        user.email.toLowerCase().includes(term) ||
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(term)),
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
          searchLabel="Search employees"
          searchExample="Juana dela Cruz"
        />
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
          <p className="text-foreground">No employees to show</p>
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
                    <TableCell>{ROLE_LABEL[user.role]}</TableCell>
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
              <p role="status" className="py-6 text-center text-muted-foreground">
                No employees match these filters
              </p>
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
