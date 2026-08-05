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
import {
  ArchiveIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  PlusIcon,
  PowerOffIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { reorderSteps } from "@/features/catalog/helpers.ts";
import { useTableView } from "@/lib/table.ts";

import { useReorderModifierGroupMutation, useReorderModifierMutation } from "./__common/queries.ts";
import {
  formatDelta,
  type ModifierGroupOutput,
  type ModifierOutput,
  SELECTION_RULE_LABEL,
} from "./helpers.ts";
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
  onAddModifier,
  onEditModifier,
  onArchiveModifier,
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
  onAddModifier: (group: ModifierGroupOutput) => void;
  onEditModifier: (group: ModifierGroupOutput, modifier: ModifierOutput) => void;
  onArchiveModifier: (modifier: ModifierOutput) => void;
  inlineError: string | null;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const reorderGroup = useReorderModifierGroupMutation();
  const reorderModifier = useReorderModifierMutation();

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
      (status === "all" || (status === "active") === !group.archivedAt) &&
      (term === "" ||
        group.name.toLowerCase().includes(term) ||
        group.modifiers.some((m) => m.name.toLowerCase().includes(term))),
  );

  const table = useTableView(visible, SORT_VALUES, "name");

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
          onStatusChange={setStatus}
          query={query}
          onQueryChange={setQuery}
          searchLabel="Search options"
          searchExample="e.g. Size"
        />
        {inlineError ? (
          <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm">
            {inlineError}
          </div>
        ) : null}
        {isPending ? (
          <p role="status">Loading…</p>
        ) : isError ? (
          <ErrorState onRetry={refetch} isFetching={isFetching} />
        ) : canDrag && ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No modifier groups yet.</p>
        ) : !canDrag && table.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No modifier groups yet.</p>
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
                        editingGroupId={editingGroupId}
                        canMutate={canMutate}
                        onEditGroup={onEditGroup}
                        onArchiveGroup={onArchiveGroup}
                        onReactivateGroup={onReactivateGroup}
                        onAddModifier={onAddModifier}
                        onEditModifier={onEditModifier}
                        onArchiveModifier={onArchiveModifier}
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
                {table.rows.map((group, index) => {
                  const activeMods = group.modifiers
                    .filter((m) => !m.archivedAt)
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
                  return (
                    <TableRow
                      key={group.id}
                      data-state={editingGroupId === group.id ? "selected" : undefined}
                    >
                      <TableCell className="font-medium">{group.name}</TableCell>
                      <TableCell>{SELECTION_RULE_LABEL[group.selectionRule]}</TableCell>
                      <TableCell>
                        <ul className="flex flex-col gap-1 text-sm">
                          {activeMods.length === 0 ? (
                            <li className="text-muted-foreground">None</li>
                          ) : (
                            activeMods.map((mod, modIndex) => (
                              <li key={mod.id} className="flex flex-wrap items-center gap-2">
                                <span>
                                  {mod.name}{" "}
                                  <span className="tabular-nums text-muted-foreground">
                                    {formatDelta(mod.delta)}
                                  </span>
                                </span>
                                {canMutate && !group.archivedAt ? (
                                  <span className="inline-flex items-center gap-0.5">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="size-7"
                                      aria-label={`Move ${mod.name} up in ${group.name}`}
                                      disabled={modIndex === 0 || reorderModifier.isPending}
                                      onClick={() =>
                                        void reorderModifier.mutateAsync({
                                          id: mod.id,
                                          direction: "up",
                                        })
                                      }
                                    >
                                      <ChevronUpIcon />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="size-7"
                                      aria-label={`Move ${mod.name} down in ${group.name}`}
                                      disabled={
                                        modIndex === activeMods.length - 1 ||
                                        reorderModifier.isPending
                                      }
                                      onClick={() =>
                                        void reorderModifier.mutateAsync({
                                          id: mod.id,
                                          direction: "down",
                                        })
                                      }
                                    >
                                      <ChevronDownIcon />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="size-7"
                                      aria-label={`Edit ${mod.name}`}
                                      onClick={() => onEditModifier(group, mod)}
                                    >
                                      <PencilIcon />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      danger
                                      className="size-7"
                                      aria-label={`Archive ${mod.name}`}
                                      onClick={() => onArchiveModifier(mod)}
                                    >
                                      <PowerOffIcon />
                                    </Button>
                                  </span>
                                ) : null}
                              </li>
                            ))
                          )}
                        </ul>
                      </TableCell>
                      <TableCell className="tabular-nums">{group.linkedToCount}</TableCell>
                      <TableCell>
                        {group.archivedAt ? (
                          <Badge variant="secondary">Archived</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canMutate ? (
                          <div className="inline-flex flex-wrap items-center justify-end gap-1">
                            {!group.archivedAt ? (
                              <>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-8"
                                  aria-label={`Move ${group.name} up in modifier groups`}
                                  disabled={index === 0 || reorderGroup.isPending}
                                  onClick={() =>
                                    void reorderGroup.mutateAsync({
                                      id: group.id,
                                      direction: "up",
                                    })
                                  }
                                >
                                  <ChevronUpIcon />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-8"
                                  aria-label={`Move ${group.name} down in modifier groups`}
                                  disabled={
                                    index === table.rows.length - 1 || reorderGroup.isPending
                                  }
                                  onClick={() =>
                                    void reorderGroup.mutateAsync({
                                      id: group.id,
                                      direction: "down",
                                    })
                                  }
                                >
                                  <ChevronDownIcon />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onEditGroup(group)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onAddModifier(group)}
                                >
                                  <PlusIcon />
                                  Modifier
                                </Button>
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  danger
                                  aria-label={`Archive modifier group ${group.name}`}
                                  onClick={() => onArchiveGroup(group)}
                                >
                                  <ArchiveIcon />
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => onReactivateGroup(group)}
                              >
                                <RotateCcwIcon />
                                Reactivate
                              </Button>
                            )}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePagination
              page={table.page}
              pageCount={table.pageCount}
              onPageChange={table.setPage}
              label="Modifier groups pages"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
