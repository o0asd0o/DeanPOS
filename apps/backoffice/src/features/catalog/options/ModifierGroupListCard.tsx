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
import { SearchXIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";
import { TableSkeleton } from "@/components/TableSkeleton.tsx";
import type { UsageFilter } from "@/components/ListToolbar.tsx";
import { ListToolbar } from "@/components/ListToolbar.tsx";
import { TablePagination } from "@/components/TablePagination.tsx";
import { reorderSteps } from "@/features/catalog/helpers.ts";
import { useTableView } from "@/lib/table.ts";

import { useReorderModifierGroupMutation } from "./__common/queries.ts";
import { getModifierGroupSignals, type ModifierGroupOutput } from "./helpers.ts";
import { SortableModifierGroupRow } from "./SortableModifierGroupRow.tsx";

type SortKey = "name" | "rule" | "linked" | "status";

const SORT_VALUES: Record<SortKey, (group: ModifierGroupOutput) => string | number> = {
  name: (g) => g.name.toLowerCase(),
  rule: (g) => g.selectionRule,
  linked: (g) => g.linkedToCount,
  status: (g) => (g.archivedAt ? 1 : 0),
};

export function ModifierGroupListCard({
  groups,
  isPending,
  isError,
  isFetching,
  refetch,
  canMutate,
  editingGroupId,
  onEditGroup,
  onArchiveGroup,
  onReactivateGroup,
  onOpenModifiers,
  inlineError,
}: {
  groups: ModifierGroupOutput[] | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  canMutate: boolean;
  editingGroupId: string | null;
  onEditGroup: (group: ModifierGroupOutput) => void;
  onArchiveGroup: (group: ModifierGroupOutput) => void;
  onReactivateGroup: (group: ModifierGroupOutput) => void;
  onOpenModifiers: (group: ModifierGroupOutput) => void;
  inlineError: string | null;
}) {
  const { usage: status, q: query } = useSearch({ from: "/_shell/add-ons" });
  const navigate = useNavigate();
  const setSearch = (next: { usage: UsageFilter; q: string }) =>
    navigate({ to: "/add-ons", search: next, replace: true });
  const reorderGroup = useReorderModifierGroupMutation();

  const term = query.trim().toLowerCase();
  const canDrag = status === "all" && term === "";

  const serverActiveOrdered = useMemo(
    () =>
      (groups ?? [])
        .filter((g) => !g.archivedAt)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    [groups],
  );
  const [ordered, setOrdered] = useState(serverActiveOrdered);
  useEffect(() => {
    if (!reorderGroup.isPending) setOrdered(serverActiveOrdered);
  }, [serverActiveOrdered, reorderGroup.isPending]);

  const visible = (groups ?? []).filter(
    (group) =>
      (status === "all" ||
        (status === "inuse" && getModifierGroupSignals(group).inUse) ||
        (status === "needsattention" && getModifierGroupSignals(group).needsAttention) ||
        (status === "unused" && getModifierGroupSignals(group).unused)) &&
      (term === "" ||
        group.name.toLowerCase().includes(term) ||
        group.modifiers.some((m) => m.name.toLowerCase().includes(term))),
  );

  const table = useTableView(visible, SORT_VALUES, "name", `${status}:${query}`);
  const hasFilters = status !== "all" || term !== "";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || reorderGroup.isPending) return;
    const fromIndex = ordered.findIndex((g) => g.id === active.id);
    const toIndex = ordered.findIndex((g) => g.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    const plan = reorderSteps(fromIndex, toIndex);
    if (!plan) return;
    setOrdered((rows) => arrayMove(rows, fromIndex, toIndex));
    for (let step = 0; step < plan.steps; step += 1) {
      const result = await reorderGroup.mutateAsync({
        id: String(active.id),
        direction: plan.direction,
      });
      if (!result) break;
    }
  };

  return (
    <Card className="gap-4">
      <CardContent className="flex flex-col gap-4">
        <ListToolbar
          status={status}
          onStatusChange={(next) => setSearch({ usage: next, q: query })}
          query={query}
          onQueryChange={(next) => setSearch({ usage: status, q: next })}
          searchLabel="Search options"
          searchExample="e.g. Size"
          variant="usage"
        />
        {inlineError ? (
          <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm">
            {inlineError}
          </div>
        ) : null}
        {isPending ? (
          <TableSkeleton variant="modifierGroups" />
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : canDrag && ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No modifier groups yet.</p>
        ) : !canDrag && table.rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={<SearchXIcon aria-hidden="true" />}
              title="No modifier groups match these filters"
              description="Try another usage or clear the search."
              action={
                <Button variant="outline" onClick={() => setSearch({ usage: "all", q: "" })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">No modifier groups yet.</p>
          )
        ) : canDrag ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={ordered.map((g) => g.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="overflow-x-auto py-1">
                <Table aria-label="Modifier groups">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <span className="sr-only">Reorder</span>
                      </TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>Modifiers</TableHead>
                      <TableHead>Linked to</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordered.map((group) => (
                      <SortableModifierGroupRow
                        key={group.id}
                        group={group}
                        disabled={reorderGroup.isPending || ordered.length < 2}
                        showGrip={true}
                        editingGroupId={editingGroupId}
                        canMutate={canMutate}
                        onEditGroup={onEditGroup}
                        onArchiveGroup={onArchiveGroup}
                        onReactivateGroup={onReactivateGroup}
                        onOpenModifiers={onOpenModifiers}
                      />
                    ))}
                    {(groups ?? [])
                      .filter((group) => group.archivedAt !== null)
                      .map((group) => (
                        <SortableModifierGroupRow
                          key={group.id}
                          group={group}
                          disabled
                          showGrip={true}
                          editingGroupId={editingGroupId}
                          canMutate={canMutate}
                          onEditGroup={onEditGroup}
                          onArchiveGroup={onArchiveGroup}
                          onReactivateGroup={onReactivateGroup}
                          onOpenModifiers={onOpenModifiers}
                        />
                      ))}
                  </TableBody>
                </Table>
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="overflow-x-auto py-1">
            <Table aria-label="Modifier groups">
              <TableHeader>
                <TableRow>
                  <TableHead sorted={table.sortedBy("name")} onSort={() => table.sortBy("name")}>
                    Group
                  </TableHead>
                  <TableHead sorted={table.sortedBy("rule")} onSort={() => table.sortBy("rule")}>
                    Rule
                  </TableHead>
                  <TableHead>Modifiers</TableHead>
                  <TableHead
                    sorted={table.sortedBy("linked")}
                    onSort={() => table.sortBy("linked")}
                  >
                    Linked to
                  </TableHead>
                  <TableHead
                    sorted={table.sortedBy("status")}
                    onSort={() => table.sortBy("status")}
                  >
                    Status
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((group) => (
                  <SortableModifierGroupRow
                    key={group.id}
                    group={group}
                    disabled={true}
                    showGrip={false}
                    editingGroupId={editingGroupId}
                    canMutate={canMutate}
                    onEditGroup={onEditGroup}
                    onArchiveGroup={onArchiveGroup}
                    onReactivateGroup={onReactivateGroup}
                    onOpenModifiers={onOpenModifiers}
                  />
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={table.page}
              pageCount={table.pageCount}
              onPageChange={table.setPage}
              label="Modifier groups pages"
              pageSize={table.pageSize}
              itemCount={table.rows.length}
              totalItems={table.totalItems}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
