import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PlusIcon, FolderOpenIcon, SearchXIcon, UtensilsCrossedIcon } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  Badge,
  TableRow,
} from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";
import { TableSkeleton } from "@/components/TableSkeleton.tsx";
import type { SellabilityFilter } from "@/components/ListToolbar.tsx";
import { ListToolbar } from "@/components/ListToolbar.tsx";
import { TablePagination } from "@/components/TablePagination.tsx";
import { PAGE_SIZE } from "@/lib/table.ts";
import {
  formatCentavos,
  type CategoryOutput,
  type MenuItemListOutput,
  type MenuItemListSort,
  type MenuItemOutput,
} from "@/features/catalog/helpers.ts";
import { SortableMenuItemRow } from "./SortableMenuItemRow.tsx";
import { MenuItemActions } from "./MenuItemActions.tsx";

export function MenuItemListCard({
  category,
  data,
  isPending,
  isError,
  isFetching,
  refetch,
  onAdd,
  onArchive,
  onReactivate,
  onReorder,
  reordering,
}: {
  category: CategoryOutput | null;
  data: MenuItemListOutput | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  onAdd: () => void;
  onArchive: (item: MenuItemOutput) => void;
  onReactivate: (item: MenuItemOutput) => void;
  onReorder: (itemId: string, fromIndex: number, toIndex: number) => void;
  reordering: boolean;
}) {
  const { status, q: query, category: categorySearch, page, sort } = useSearch({
    from: "/_shell/catalog",
  });
  const navigate = useNavigate();
  const setSearch = (next: { status: SellabilityFilter; q: string }) =>
    navigate({
      to: "/catalog",
      search: { status: next.status, q: next.q, category: categorySearch, page: 1, sort },
      replace: true,
    });
  const setPage = (nextPage: number) =>
    navigate({
      to: "/catalog",
      search: { status, q: query, category: categorySearch, page: nextPage, sort },
      replace: true,
    });
  const setSort = (key: MenuItemListSort["key"]) =>
    navigate({
      to: "/catalog",
      search: {
        status,
        q: query,
        category: categorySearch,
        page: 1,
        sort:
          sort.key === key
            ? { key, direction: sort.direction === "asc" ? "desc" : "asc" }
            : { key, direction: "asc" },
      },
      replace: true,
    });

  const inCategory = useMemo(
    () => (data?.items ?? []).filter((item) => category !== null && item.categoryId === category.id),
    [data, category],
  );
  const term = query.trim().toLowerCase();
  const serverActiveOrdered = useMemo(
    () =>
      inCategory
        .filter((item) => item.archivedAt === null)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    [inCategory],
  );

  // Drag only when the full active order is on screen — search/filter breaks position meaning.
  const canDrag =
    category !== null &&
    category.archivedAt === null &&
    status === "all" &&
    term === "" &&
    data !== undefined &&
    data.count <= PAGE_SIZE &&
    sort.key === "sortOrder";

  const [ordered, setOrdered] = useState(serverActiveOrdered);
  useEffect(() => {
    if (!reordering) setOrdered(serverActiveOrdered);
  }, [serverActiveOrdered, reordering]);

  const hasFilters = status !== "all" || term !== "";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || reordering || !canDrag) return;
    const fromIndex = ordered.findIndex((item) => item.id === active.id);
    const toIndex = ordered.findIndex((item) => item.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    setOrdered((rows) => arrayMove(rows, fromIndex, toIndex));
    onReorder(String(active.id), fromIndex, toIndex);
  };

  const body = () => {
    if (isPending) return <TableSkeleton variant="menuItems" />;
    if (isError) return <ErrorState onRetry={refetch} isFetching={isFetching} />;
    if (!category) {
      return (
        <EmptyState
          icon={<FolderOpenIcon aria-hidden="true" />}
          title="Select a category"
          description="Pick a category on the left to see the menu items filed under it."
        />
      );
    }
    if (inCategory.length === 0 && data?.totalCount === 0) {
      return (
        <EmptyState
          icon={<UtensilsCrossedIcon aria-hidden="true" />}
          title="No menu items yet"
          description="Add the first item in this category and set its price. Items stay drafts until they have a variant."
        />
      );
    }

    if (inCategory.length === 0) {
      return (
        <EmptyState
          icon={<SearchXIcon aria-hidden="true" />}
          title="No menu items match these filters"
          description="Try another status, or clear the search."
          action={
            hasFilters && (
              <Button variant="outline" onClick={() => setSearch({ status: "all", q: "" })}>
                Clear filters
              </Button>
            )
          }
        />
      );
    }

    if (canDrag) {
      return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={ordered.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="overflow-x-auto py-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <span className="sr-only">Reorder</span>
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Variants</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordered.map((item) => (
                    <SortableMenuItemRow
                      key={item.id}
                      item={item}
                      disabled={reordering || ordered.length < 2}
                      onArchive={onArchive}
                    />
                  ))}
                  {inCategory
                    .filter((item) => item.archivedAt !== null)
                    .map((item) => (
                      <TableRow key={item.id} className="last:!border-b">
                        <TableCell />
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>
                          <Badge variant="secondary">Archived</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <MenuItemActions item={item} onReactivate={onReactivate} />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </SortableContext>
        </DndContext>
      );
    }

    return (
      <>
        <div className="overflow-x-auto py-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" onClick={() => setSort("name")}>
                    Name
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => setSort("price")}>
                    Price
                  </button>
                </TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inCategory.map((item) => {
                const archived = item.archivedAt !== null;
                return (
                  <TableRow key={item.id} className="last:!border-b">
                    <TableCell className="font-medium">
                      {archived ? (
                        item.name
                      ) : (
                        <Link
                          to="/catalog/$id"
                          params={{ id: item.id }}
                          className="underline-offset-4 hover:underline"
                        >
                          {item.name}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {archived ? "—" : formatCentavos(item.priceCentavos)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {archived ? (
                        "—"
                      ) : (
                        <Link
                          to="/catalog/$id"
                          params={{ id: item.id }}
                          className="underline-offset-4 hover:underline"
                        >
                          {item.activeVariantCount}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          archived
                            ? "secondary"
                            : item.activeVariantCount > 0
                              ? "success"
                              : "warning"
                        }
                      >
                        {archived ? "Archived" : item.activeVariantCount > 0 ? "Live" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {archived ? (
                        <MenuItemActions item={item} onReactivate={onReactivate} />
                      ) : (
                        <MenuItemActions item={item} onArchive={onArchive} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <TablePagination
          page={data?.page ?? page}
          pageCount={Math.max(1, Math.ceil((data?.count ?? 0) / (data?.perPage ?? PAGE_SIZE)))}
          onPageChange={setPage}
          label="Menu items pages"
          pageSize={data?.perPage ?? PAGE_SIZE}
          itemCount={inCategory.length}
          totalItems={data?.count ?? 0}
        />
      </>
    );
  };

  return (
    <Card className="gap-4">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{category ? category.name : "Menu items"}</h2>
            <p className="text-sm text-muted-foreground">
              {data?.totalCount ?? 0} item{data?.totalCount === 1 ? "" : "s"} ·{" "}
              {data?.liveCount ?? 0}{" "}
              live
            </p>
          </div>
          {category && category.archivedAt === null && (
            <Button onClick={onAdd} className="tap-target">
              <PlusIcon aria-hidden="true" />
              Add menu item
            </Button>
          )}
        </div>
        <ListToolbar
          status={status}
          onStatusChange={(next) => setSearch({ status: next, q: query })}
          query={query}
          onQueryChange={(next) => setSearch({ status, q: next })}
          searchLabel="Search menu items"
          searchExample="Adobo"
          variant="sellability"
        />
        {body()}
      </CardContent>
    </Card>
  );
}
