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
import type { StoreOutput } from "./helpers.ts";

// The list (record 038 §§2–3, 6). A deactivated Store stays inline, at full
// contrast, badged, with `Reactivate` as its only row action — never hidden,
// filtered or dimmed.
export function StoreListCard({
  stores,
  isPending,
  isError,
  isFetching,
  refetch,
  isAdmin,
  editingId,
  reactivatingId,
  onAdd,
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
  onAdd: () => void;
  onEdit: (store: StoreOutput) => void;
  onDeactivate: (store: StoreOutput) => void;
  onReactivate: (store: StoreOutput) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          Stores
        </CardTitle>
        {isAdmin && (
          <CardAction>
            <Button onClick={onAdd} className="tap-target">
              Add store
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <p role="status">Loading…</p>
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : stores && stores.length > 0 ? (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Stores">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Business-day start</TableHead>
                  <TableHead>Table labels</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && (
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
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
                      <TableCell>
                        <div className="flex gap-1">
                          {store.active && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="tap-target"
                                aria-label={`Edit ${store.name}`}
                                onClick={() => onEdit(store)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="tap-target"
                                aria-label={`Deactivate ${store.name}`}
                                onClick={() => onDeactivate(store)}
                              >
                                Deactivate
                              </Button>
                            </>
                          )}
                          {!store.active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="tap-target"
                              aria-label={`Reactivate ${store.name}`}
                              aria-disabled={reactivatingId === store.id}
                              onClick={() => onReactivate(store)}
                            >
                              {reactivatingId === store.id ? "Reactivating…" : "Reactivate"}
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
          <>
            <p className="text-foreground">No stores yet</p>
            <p className="text-foreground">
              A store is one outlet — its own sales, its own devices, and its own table labels. Use
              Add store above to create the first one.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
