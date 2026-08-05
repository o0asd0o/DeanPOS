import { useEffect, useMemo, useState } from "react";
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
import { PlusIcon } from "lucide-react";
import { Badge, Button, Card, CardAction, CardContent, CardHeader, CardTitle } from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";
import type { CategoryOutput } from "@/features/catalog/helpers.ts";
import { SortableCategoryRow } from "./SortableCategoryRow.tsx";

export function CategoryRail({
  categories,
  isPending,
  isError,
  isFetching,
  refetch,
  selectedId,
  onSelect,
  onAdd,
  onReorder,
  onRename,
  onArchive,
  onReactivate,
  reordering,
}: {
  categories: CategoryOutput[] | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  selectedId: string | null;
  onSelect: (category: CategoryOutput) => void;
  onAdd: () => void;
  onReorder: (categoryId: string, fromIndex: number, toIndex: number) => void;
  onRename: (category: CategoryOutput) => void;
  onArchive: (category: CategoryOutput) => void;
  onReactivate: (category: CategoryOutput) => void;
  reordering: boolean;
}) {
  const serverActive = useMemo(
    () =>
      (categories ?? [])
        .filter((category) => category.archivedAt === null)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    [categories],
  );
  const archived = useMemo(
    () => (categories ?? []).filter((category) => category.archivedAt !== null),
    [categories],
  );

  const [ordered, setOrdered] = useState(serverActive);
  useEffect(() => {
    if (!reordering) setOrdered(serverActive);
  }, [serverActive, reordering]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || reordering) return;
    const fromIndex = ordered.findIndex((category) => category.id === active.id);
    const toIndex = ordered.findIndex((category) => category.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    setOrdered((rows) => arrayMove(rows, fromIndex, toIndex));
    onReorder(String(active.id), fromIndex, toIndex);
  };

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Categories</CardTitle>
        <CardAction>
          <Button size="sm" onClick={onAdd} className="tap-target">
            <PlusIcon aria-hidden="true" />
            Add
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isPending ? (
          <p role="status">Loading…</p>
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : !categories || categories.length === 0 ? (
          <p role="status" className="text-muted-foreground">
            No categories yet
          </p>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={ordered.map((category) => category.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2" aria-label="Categories">
                  {ordered.map((category) => (
                    <SortableCategoryRow
                      key={category.id}
                      category={category}
                      selected={selectedId === category.id}
                      disabled={reordering || ordered.length < 2}
                      onSelect={onSelect}
                      onRename={onRename}
                      onArchive={onArchive}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {archived.length > 0 && (
              <div className="mt-2 flex flex-col gap-2 border-t pt-2">
                <p className="text-xs font-medium text-muted-foreground">Archived</p>
                {archived.map((category) => (
                  <div key={category.id} className="flex items-center gap-2 px-2 py-1">
                    <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
                    <Badge variant="secondary">Archived</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReactivate(category)}
                      className="tap-target"
                    >
                      Reactivate
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
