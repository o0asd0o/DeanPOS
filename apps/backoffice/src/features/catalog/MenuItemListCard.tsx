import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
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
import { PlusIcon, ArchiveIcon } from "lucide-react";
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
import type { CategoryOutput, MenuItemOutput } from "./helpers.ts";
import { SortableMenuItemRow } from "./SortableMenuItemRow.tsx";

type SortKey = "name" | "status";

const SORT_VALUES: Record<SortKey, (item: MenuItemOutput) => string | number> = {
  name: (item) => item.name.toLowerCase(),
  status: (item) => (item.archivedAt ? 1 : 0),
};

export function MenuItemListCard({
  category,
  menuItems,
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
  menuItems: MenuItemOutput[] | undefined;
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
  const [status, setStatus] = useState<StatusFilter>("active");
  const [query, setQuery] = useState("");

  const inCategory = useMemo(
    () => (menuItems ?? []).filter((item) => category !== null && item.categoryId === category.id),
    [menuItems, category],
  );
  const term = query.trim().toLowerCase();
  // Drag only when the full active order is on screen — search/filter breaks position meaning.
  const canDrag =
    category !== null && category.archivedAt === null && status === "active" && term === "";

  const serverActiveOrdered = useMemo(
    () =>
      inCategory
        .filter((item) => item.archivedAt === null)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    [inCategory],
  );

  const [ordered, setOrdered] = useState(serverActiveOrdered);
  useEffect(() => {
    if (!reordering) setOrdered(serverActiveOrdered);
  }, [serverActiveOrdered, reordering]);

  const filtered = inCategory.filter(
    (item) =>
      (status === "all" ||
        (status === "active" && item.archivedAt === null) ||
        (status === "deactivated" && item.archivedAt !== null)) &&
      (term === "" || item.name.toLowerCase().includes(term)),
  );
  const table = useTableView(canDrag ? ordered : filtered, SORT_VALUES, "name");

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
    if (isPending) return <p role="status">Loading…</p>;
    if (isError) return <ErrorState onRetry={refetch} isFetching={isFetching} />;
    if (!category) {
      return (
        <p role="status" className="text-muted-foreground">
          Select a category
        </p>
      );
    }
    if (inCategory.length === 0) {
      return (
        <p role="status" className="text-muted-foreground">
          No menu items yet
        </p>
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
                  <button type="button" onClick={() => table.sortBy("name")}>
                    Name
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => table.sortBy("status")}>
                    Status
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((item) => {
                const archived = item.archivedAt !== null;
                return (
                  <TableRow key={item.id}>
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
                    <TableCell>
                      {archived ? (
                        <Badge variant="secondary">Archived</Badge>
                      ) : item.sellable ? (
                        <Badge variant="success">Sellable</Badge>
                      ) : (
                        <Badge variant="warning">Not sellable — no variant</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {archived ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onReactivate(item)}
                          className="tap-target"
                        >
                          Reactivate
                        </Button>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="sm" className="tap-target" asChild>
                            <Link to="/catalog/$id" params={{ id: item.id }}>
                              {item.sellable ? "Edit" : "Add a variant"}
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            danger
                            aria-label={`Archive menu item ${item.name}`}
                            onClick={() => onArchive(item)}
                            className="tap-target"
                          >
                            <ArchiveIcon aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <TablePagination
          page={table.page}
          pageCount={table.pageCount}
          onPageChange={table.setPage}
          label="Menu items pages"
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
              Drafts stay here until a variant makes them sellable.
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
          onStatusChange={setStatus}
          query={query}
          onQueryChange={setQuery}
          searchLabel="Search menu items"
          searchExample="Adobo"
        />
        {body()}
      </CardContent>
    </Card>
  );
}
