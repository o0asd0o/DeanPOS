import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";
import type { UserOutput } from "./helpers.ts";

const ROLE_LABEL: Record<UserOutput["role"], string> = {
  cashier: "Cashier",
  manager: "Manager",
  admin: "Admin",
};

function storeNamesFor(storeIds: string[], stores: { id: string; name: string }[]): string {
  const assigned = new Set(storeIds);
  const names = stores.filter((store) => assigned.has(store.id)).map((store) => store.name);
  return names.length > 0 ? names.join(", ") : "None";
}

// The list (record 044 §§1–4). A deactivated User stays inline, at full
// contrast, badged, with `Reactivate` as its only row action — never
// hidden, filtered or dimmed. No `Name` column and no `PIN` column — `User`
// has no name field, and the PIN half of this screen is issue 10.
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
  onAdd,
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
  onAdd: () => void;
  onEdit: (user: UserOutput) => void;
  onDeactivate: (user: UserOutput) => void;
  onReactivate: (user: UserOutput) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          Users
        </CardTitle>
        {isAdmin && (
          <CardAction>
            <Button onClick={onAdd} className="tap-target">
              Add user
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {reactivateFailed && (
          <div
            role="alert"
            className="mb-2 rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t update the user
          </div>
        )}
        {isPending ? (
          <p role="status">Loading…</p>
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : users && users.length > 0 ? (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Users">
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Stores</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && (
                    <TableHead>
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
                      <TableCell>
                        <div className="flex gap-1">
                          {user.active && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="tap-target"
                                aria-label={`Edit ${user.email}`}
                                onClick={() => onEdit(user)}
                              >
                                Edit
                              </Button>
                              {user.id !== callerId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="tap-target"
                                  aria-label={`Deactivate ${user.email}`}
                                  onClick={() => onDeactivate(user)}
                                >
                                  Deactivate
                                </Button>
                              )}
                            </>
                          )}
                          {!user.active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="tap-target"
                              aria-label={`Reactivate ${user.email}`}
                              aria-disabled={reactivatingId === user.id}
                              onClick={() => onReactivate(user)}
                            >
                              {reactivatingId === user.id ? "Reactivating…" : "Reactivate"}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-foreground">No users to show</p>
        )}
      </CardContent>
    </Card>
  );
}
