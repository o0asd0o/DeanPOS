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
import type { StoreOutput } from "./helpers.ts";

// The list (record 038 §§2–3, 6), in the Users list's shape: the card holds
// the toolbar and the table only, the title and `Add store` sit in the page
// header above it. A deactivated Store stays inline, at full contrast,
// badged, with `Reactivate` as its only row action — never hidden or dimmed.
export function StoreListCard({
  stores,
  isPending,
  isError,
  isFetching,
  refetch,
  isAdmin,
  editingId,
  reactivatingId,
  reactivateFailed,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  stores: StoreOutput[] | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  isAdmin: boolean;
  editingId: string | null;
  reactivatingId: string | null;
  reactivateFailed: boolean;
  onEdit: (store: StoreOutput) => void;
  onDeactivate: (store: StoreOutput) => void;
  onReactivate: (store: StoreOutput) => void;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const term = query.trim().toLowerCase();
  const visible = (stores ?? []).filter(
    (store) =>
      (status === "all" || (status === "active") === store.active) &&
      (term === "" || store.name.toLowerCase().includes(term)),
  );

  return (
    <Card className="gap-4">
      <CardContent className="flex flex-col gap-4">
        <ListToolbar
          status={status}
          onStatusChange={setStatus}
          query={query}
          onQueryChange={setQuery}
          searchLabel="Search stores"
        />
        {reactivateFailed && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t update the store
          </div>
        )}
        {isPending ? (
          <p role="status">Loading…</p>
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : !stores || stores.length === 0 ? (
          <>
            <p className="text-foreground">No stores yet</p>
            {isAdmin && (
              <p className="text-foreground">
                A store is one outlet — its own sales, its own devices, and its own table labels.
                Use Add store above to create the first one.
              </p>
            )}
          </>
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Stores">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Business-day start</TableHead>
                  <TableHead>Table labels</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && (
                    <TableHead className="w-0 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((store) => (
                  <TableRow
                    key={store.id}
                    data-state={store.id === editingId ? "selected" : undefined}
                  >
                    <TableCell>{store.name}</TableCell>
                    <TableCell>{store.businessDayStart}</TableCell>
                    <TableCell>{store.tableLabels.length || "None"}</TableCell>
                    <TableCell>
                      {store.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Deactivated</Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {store.active && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="tap-target"
                                aria-label={`Edit ${store.name}`}
                                onClick={() => onEdit(store)}
                              >
                                <PencilIcon />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                danger
                                size="sm"
                                className="tap-target"
                                aria-label={`Deactivate ${store.name}`}
                                onClick={() => onDeactivate(store)}
                              >
                                <PowerOffIcon />
                                Deactivate
                              </Button>
                            </>
                          )}
                          {!store.active && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="tap-target"
                              aria-label={`Reactivate ${store.name}`}
                              aria-disabled={reactivatingId === store.id}
                              onClick={() => onReactivate(store)}
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
                No stores match these filters
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
