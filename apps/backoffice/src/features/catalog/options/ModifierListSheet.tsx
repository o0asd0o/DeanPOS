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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVerticalIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  PowerOffIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  toast,
} from "ui";

import { reorderSteps } from "@/features/catalog/helpers.ts";

import {
  useArchiveModifierMutation,
  useReactivateModifierMutation,
  useReorderModifierMutation,
} from "./__common/queries.ts";
import { ModifierForm } from "./ModifierForm.tsx";
import { formatDelta, type ModifierGroupOutput, type ModifierOutput } from "./helpers.ts";

type SheetPage = { view: "list" } | { view: "edit"; modifier: ModifierOutput | null };

function SortableModifierRow({
  mod,
  groupArchivedAt,
  canMutate,
  disabled,
  onEdit,
  onArchive,
}: {
  mod: ModifierOutput;
  groupArchivedAt: Date | null | undefined;
  canMutate: boolean;
  disabled: boolean;
  onEdit: (mod: ModifierOutput) => void;
  onArchive: (mod: ModifierOutput) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mod.id,
    disabled,
  });

  const interactive = canMutate && !groupArchivedAt;

  return (
    <div
      ref={setNodeRef}
      // design-exempt: dnd-kit needs live transform and transition while dragging
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        isDragging && "relative z-10 bg-background shadow-md",
      )}
    >
      {interactive ? (
        <button
          type="button"
          className="tap-target inline-flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Drag ${mod.name}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon aria-hidden="true" className="size-4" />
        </button>
      ) : null}
      <span className="flex-1">
        {mod.name}{" "}
        <span className="tabular-nums text-muted-foreground">{formatDelta(mod.delta)}</span>
      </span>
      {interactive ? (
        <span className="inline-flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label={`Edit ${mod.name}`}
            onClick={() => onEdit(mod)}
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
            onClick={() => onArchive(mod)}
          >
            <PowerOffIcon />
          </Button>
        </span>
      ) : null}
    </div>
  );
}

export function ModifierListSheet({
  group,
  open,
  onOpenChange,
  onAnnounce,
  canMutate,
}: {
  group: ModifierGroupOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnnounce: (msg: string) => void;
  canMutate: boolean;
}) {
  const [page, setPage] = useState<SheetPage>({ view: "list" });
  const [query, setQuery] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<ModifierOutput | null>(null);
  const [pendingItemName, setPendingItemName] = useState<string | null>(null);

  const archiveModifier = useArchiveModifierMutation();
  const reactivateModifier = useReactivateModifierMutation();
  const reorderModifier = useReorderModifierMutation();

  const activeMods = useMemo(
    () =>
      group.modifiers
        .filter((m) => !m.archivedAt)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    [group.modifiers],
  );
  const [ordered, setOrdered] = useState(activeMods);
  const archivedMods = useMemo(
    () => group.modifiers.filter((modifier) => modifier.archivedAt),
    [group.modifiers],
  );
  const term = query.trim().toLowerCase();
  const filteredOrdered = ordered.filter((modifier) => modifier.name.toLowerCase().includes(term));
  const filteredArchived = archivedMods.filter((modifier) =>
    modifier.name.toLowerCase().includes(term),
  );
  useEffect(() => {
    if (!reorderModifier.isPending) setOrdered(activeMods);
  }, [activeMods, reorderModifier.isPending]);

  useEffect(() => {
    if (pendingItemName) setPendingItemName(null);
  }, [activeMods]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) setPage({ view: "list" });
  }, [open]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || reorderModifier.isPending) return;
    const fromIndex = ordered.findIndex((m) => m.id === active.id);
    const toIndex = ordered.findIndex((m) => m.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    const plan = reorderSteps(fromIndex, toIndex);
    if (!plan) return;
    setOrdered((rows) => arrayMove(rows, fromIndex, toIndex));
    for (let step = 0; step < plan.steps; step += 1) {
      const result = await reorderModifier.mutateAsync({
        id: String(active.id),
        direction: plan.direction,
      });
      if (!result) break;
    }
  };

  const inEditMode = page.view === "edit";

  return (
    <>
      <Sheet modal={false} open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="detached-panel inset-y-4 right-4 h-auto rounded-2xl border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        >
          <SheetTitle className="sr-only">
            {inEditMode
              ? page.modifier
                ? `Edit ${page.modifier.name}`
                : `New modifier · ${group.name}`
              : `Modifiers · ${group.name}`}
          </SheetTitle>
          <div className="flex h-full overflow-hidden rounded-2xl bg-card text-card-foreground">
            {/* Slide container: width 200% keeps both panels full-width side by side */}
            <div
              className="flex h-full flex-shrink-0 transition-transform duration-300 ease-in-out"
              style={{
                width: "200%",
                transform: inEditMode ? "translateX(-50%)" : "translateX(0)",
              }}
            >
              {/* Panel 1 — modifier list */}
              <div className="flex h-full w-1/2 flex-col overflow-hidden">
                <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                  <h2 className="text-lg font-semibold">
                    Modifiers · {group.name} · {activeMods.length} active · {archivedMods.length}{" "}
                    archived
                  </h2>
                  <SheetClose asChild>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Close">
                      <XIcon />
                    </Button>
                  </SheetClose>
                </div>
                <div className="scrollbar-slim flex flex-1 flex-col overflow-y-auto p-2">
                  <p className="px-2 pb-2 pt-1 text-sm text-muted-foreground">
                    Drag to reorder. Changes apply immediately.
                  </p>
                  <label className="sr-only" htmlFor="modifier-search">
                    Search modifiers
                  </label>
                  <Input
                    id="modifier-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search modifiers"
                    className="mb-2"
                  />
                  {filteredOrdered.length === 0 && filteredArchived.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">
                      {term ? "No modifiers match this search." : "No modifiers yet."}
                    </p>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={filteredOrdered.map((m) => m.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {filteredOrdered.map((mod) => (
                          <SortableModifierRow
                            key={mod.id}
                            mod={mod}
                            groupArchivedAt={group.archivedAt}
                            canMutate={canMutate}
                            disabled={reorderModifier.isPending || ordered.length < 2}
                            onEdit={(m) => setPage({ view: "edit", modifier: m })}
                            onArchive={setArchiveTarget}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                  {filteredArchived.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-1">
                      <p className="px-2 text-sm font-medium text-muted-foreground">Archived</p>
                      {filteredArchived.map((modifier) => (
                        <div
                          key={modifier.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground opacity-70"
                        >
                          <span className="flex-1">
                            {modifier.name}{" "}
                            <span className="tabular-nums">{formatDelta(modifier.delta)}</span>
                          </span>
                          {canMutate && !group.archivedAt ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const result = await reactivateModifier.mutateAsync({
                                  id: modifier.id,
                                });
                                if (result) onAnnounce(`${modifier.name} reactivated`);
                              }}
                            >
                              <RotateCcwIcon />
                              Reactivate
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {pendingItemName ? (
                    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground opacity-60">
                      <span className="inline-flex size-8 items-center justify-center">
                        <Loader2Icon className="size-4 animate-spin" />
                      </span>
                      <span>{pendingItemName}</span>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2 border-t p-3">
                  <SheetClose asChild>
                    <Button type="button" variant="outline">
                      <XIcon />
                      Close
                    </Button>
                  </SheetClose>
                  {canMutate && !group.archivedAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPage({ view: "edit", modifier: null })}
                    >
                      <PlusIcon />
                      Add modifier
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Panel 2 — edit form */}
              <div className="flex h-full w-1/2 flex-col overflow-hidden" aria-hidden={!inEditMode}>
                {inEditMode ? (
                  <ModifierForm
                    key={page.modifier ? `edit-${page.modifier.id}` : `create-${group.id}`}
                    group={group}
                    modifier={page.modifier}
                    onCancel={() => setPage({ view: "list" })}
                    onSaved={(msg) => {
                      toast(msg);
                      onAnnounce(msg);
                      setPage({ view: "list" });
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={archiveTarget !== null}
        onOpenChange={(o) => {
          if (!o) setArchiveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {archiveTarget?.name}?</DialogTitle>
            <DialogDescription>
              This modifier will be hidden from new orders. You can reactivate it later.
            </DialogDescription>
          </DialogHeader>
          {archiveModifier.isError ? (
            <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm">
              Couldn't archive the modifier.
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              danger
              aria-disabled={archiveModifier.isPending}
              onClick={async () => {
                if (!archiveTarget || archiveModifier.isPending) return;
                const result = await archiveModifier.mutateAsync({
                  id: archiveTarget.id,
                });
                if (!result) return;
                onAnnounce(`${archiveTarget.name} archived`);
                setArchiveTarget(null);
              }}
            >
              {archiveModifier.isPending ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
