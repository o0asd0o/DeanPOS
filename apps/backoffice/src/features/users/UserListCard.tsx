import { useState } from "react";
import { Search, PencilIcon, PowerOffIcon, RotateCcwIcon } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  Input,
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

// Every label carries the `Status:` prefix: a bare `Deactivated` pill would
// shadow a row's `Deactivate <email>` action for anything matching by name.
const STATUS_FILTERS = [
  { value: "all", label: "Status: All" },
  { value: "active", label: "Status: Active" },
  { value: "deactivated", label: "Status: Deactivated" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

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
      (term === "" || user.email.toLowerCase().includes(term)),
  );

  return (
    <Card className="gap-4">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Filter by status"
            className="inline-flex items-center gap-1 rounded-full bg-tab-list p-1"
          >
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={status === filter.value}
                onClick={() => setStatus(filter.value)}
                className={cn(
                  "tap-target rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  status === filter.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-foreground/60 hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search users"
              placeholder="Search users"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="rounded-full pr-10"
            />
          </div>
        </div>
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
          <p className="text-foreground">No users to show</p>
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Users">
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Stores</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && (
                    <TableHead className="w-0 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((user) => (
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
                No users match these filters
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
