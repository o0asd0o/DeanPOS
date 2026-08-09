import { useBlocker, useNavigate, useSearch } from "@tanstack/react-router";
import { SearchIcon, SearchXIcon, UtensilsIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  EmptyState,
  Input,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ui";
import { ErrorState } from "@/components/ErrorState.tsx";
import { TablePagination } from "@/components/TablePagination.tsx";
import { StoreCombobox } from "./StoreCombobox.tsx";
import { draftKey, SAVED_LINE } from "./helpers.ts";
import {
  useAvailabilityQuery,
  useSetAvailabilityMutation,
  useStoresQuery,
} from "./__common/queries.ts";

export function Availability() {
  const { store, q, page, sort } = useSearch({ from: "/_shell/availability" });
  const navigate = useNavigate();
  const storesQuery = useStoresQuery();
  const stores = storesQuery.data?.items ?? [];
  const activeStore = store || stores[0]?.id || "";
  const [draft, setDraft] = useState<Map<string, boolean>>(new Map());
  const [saved, setSaved] = useState("");
  const [error, setError] = useState(false);
  const listQuery = useAvailabilityQuery({
    storeId: activeStore,
    page,
    perPage: 25,
    search: q || undefined,
    sort,
  });
  const mutation = useSetAvailabilityMutation();
  const effective = (row: { kind: "variant" | "menuItem"; id: string; available: boolean }) =>
    draft.get(draftKey(row.kind, row.id)) ?? row.available;
  const dirtyRows = useMemo(() => [...draft.entries()], [draft]);
  const storeName = stores.find((item) => item.id === activeStore)?.name ?? "this store";
  useBlocker({
    withResolver: true,
    enableBeforeUnload: () => draft.size > 0,
    shouldBlockFn: ({ current, next }) => {
      if (draft.size === 0) return false;
      if (current.routeId !== "/_shell/availability" || next.routeId !== "/_shell/availability")
        return true;
      const readStore = (value: unknown) => (value as { store?: string } | undefined)?.store ?? "";
      return readStore(next.search) !== readStore(current.search);
    },
  });
  const setSearch = (next: { store?: string; q?: string; page?: number }) =>
    navigate({
      to: "/availability",
      search: { store: next.store ?? activeStore, q: next.q ?? q, page: next.page ?? 1, sort },
      replace: true,
    });
  const save = async () => {
    setError(false);
    const changes = dirtyRows.map(([key, available]) => {
      const [kind, id] = key.split(":") as ["variant" | "menuItem", string];
      return { target: { kind, id }, available };
    });
    const result = await mutation.mutateAsync({ storeId: activeStore, changes }).catch(() => null);
    if (!result) {
      setError(true);
      return;
    }
    setSaved(SAVED_LINE(result.version));
    setDraft(new Map());
  };
  const markAll = () => {
    const next = new Map(draft);
    for (const target of listQuery.data?.unavailableInScope ?? [])
      if (effective({ ...target, available: false }) === false)
        next.set(draftKey(target.kind, target.id), true);
    setDraft(next);
  };
  const pageCount = Math.max(
    1,
    Math.ceil((listQuery.data?.count ?? 0) / (listQuery.data?.perPage ?? 1)),
  );
  return (
    <div className="flex flex-col gap-4 p-4">
      <p role="status" className="sr-only">
        {saved}
      </p>
      <p role="status" className="sr-only" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Availability</h1>
          <p className="text-sm text-muted-foreground">
            Take a dish off the floor at one Store. Nothing here changes stock.
          </p>
        </div>
      </div>
      <Card className="gap-4">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-start gap-3">
            <div className="flex w-full max-w-sm flex-col gap-1.5">
              <label
                htmlFor="availability-search"
                className="text-xs font-medium text-muted-foreground"
              >
                Search availability
              </label>
              <div className="relative">
                <Input
                  id="availability-search"
                  placeholder="Dish or variant name"
                  value={q}
                  onChange={(event) => setSearch({ q: event.target.value })}
                  className="rounded-full pr-10"
                />
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
              </div>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Store</label>
              <StoreCombobox
                stores={stores}
                value={activeStore}
                onValueChange={(value) => {
                  setDraft(new Map());
                  setSearch({ store: value });
                }}
              />
            </div>
            <Button variant="outline" onClick={markAll}>
              Mark all available
            </Button>
          </div>
          {error && (
            <div role="alert" className="mx-4 rounded-md bg-status-danger-tint p-3 text-sm">
              Couldn&rsquo;t save availability
            </div>
          )}
          {listQuery.isPending ? (
            <p role="status" className="p-4 text-sm text-muted-foreground">
              Loading availability…
            </p>
          ) : listQuery.isError ? (
            <ErrorState
              onRetry={() => void listQuery.refetch()}
              isFetching={listQuery.isFetching}
            />
          ) : listQuery.data?.items.length === 0 ? (
            q ? (
              <EmptyState
                icon={<SearchXIcon aria-hidden="true" />}
                title="No menu items match this search"
                description="Try another dish or variant name."
              />
            ) : (
              <EmptyState
                icon={<UtensilsIcon aria-hidden="true" />}
                title="No menu items yet"
                description="Availability follows the catalog. Add a menu item, and it appears here."
              />
            )
          ) : (
            <div className="overflow-x-auto py-1">
              <Table aria-label="Availability">
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead>Menu item</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="w-40 whitespace-nowrap">
                      Available at {storeName}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQuery.data?.items.map((row) => {
                    const dirty = draft.has(draftKey(row.kind, row.id));
                    const available = effective(row);
                    return (
                      <TableRow
                        key={`${row.kind}:${row.id}`}
                        data-state={dirty ? "selected" : undefined}
                        className="last:!border-b"
                      >
                        <TableCell>{row.kind === "variant" ? row.name : "—"}</TableCell>
                        <TableCell>{row.menuItemName ?? row.name}</TableCell>
                        <TableCell>₱{(row.priceCentavos / 100).toFixed(2)}</TableCell>
                        <TableCell className="w-40 whitespace-nowrap">
                          <label className="tap-target inline-flex items-center gap-3">
                            <Switch
                              checked={available}
                              aria-label={`${row.name} at ${storeName}`}
                              onCheckedChange={(checked) =>
                                setDraft((current) =>
                                  new Map(current).set(draftKey(row.kind, row.id), checked),
                                )
                              }
                            />
                            <span aria-hidden="true">{available ? "On" : "Off"}</span>
                            {dirty && <span className="text-xs text-primary">Unsaved</span>}
                          </label>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePagination
                page={listQuery.data?.page ?? 1}
                pageCount={pageCount}
                onPageChange={(nextPage) => setSearch({ page: nextPage })}
                label="Availability pages"
                pageSize={listQuery.data?.perPage ?? 1}
                itemCount={listQuery.data?.items.length ?? 0}
                totalItems={listQuery.data?.count ?? 0}
              />
            </div>
          )}
        </CardContent>
        {dirtyRows.length > 0 && (
          <CardFooter className="sticky bottom-0 justify-between gap-4 border-t border-border bg-card pb-4 shadow-[0_-4px_12px_rgb(0_0_0/0.04)]">
            <span className="text-sm">
              {dirtyRows.length} unsaved change{dirtyRows.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(new Map());
                  setError(false);
                }}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={mutation.isPending} aria-busy={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
