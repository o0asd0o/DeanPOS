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
import { ArchiveIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { Button, Card, CardAction, CardContent, CardHeader, CardTitle } from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";
import type { CategoryOutput } from "@/features/catalog/helpers.ts";
import { ArchivedCategoriesDialog } from "./ArchivedCategoriesDialog.tsx";
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
  reactivating,
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
  reactivating: boolean;
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
  const [archivesOpen, setArchivesOpen] = useState(false);
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
    <Card className="gap-0 overflow-hidden">
      <CardHeader className="border-b pb-4">
        <div>
          <CardTitle>Categories</CardTitle>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {serverActive.length} active
          </p>
        </div>
        <CardAction>
          <Button size="sm" onClick={onAdd} className="tap-target">
            <PlusIcon aria-hidden="true" />
            Add
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
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
                <div className="flex flex-col gap-1" aria-label="Active categories">
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
              <Button
                type="button"
                variant="ghost"
                className="tap-target h-auto w-full justify-start gap-2 rounded-lg border border-dashed px-3 py-3 text-left hover:bg-muted/50"
                onClick={() => setArchivesOpen(true)}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-warning-tint text-status-warning-tone">
                  <ArchiveIcon aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">Archived categories</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {archived.length} archived
                  </span>
                </span>
                <ChevronRightIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </Button>
            )}
          </>
        )}
      </CardContent>
      <ArchivedCategoriesDialog
        categories={archived}
        open={archivesOpen}
        onOpenChange={setArchivesOpen}
        onReactivate={onReactivate}
        reactivating={reactivating}
      />
    </Card>
  );
}
