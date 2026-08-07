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
import { useForm } from "@tanstack/react-form";
import {
  ArrowLeftIcon,
  CheckIcon,
  GripVerticalIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  PowerOffIcon,
  XIcon,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
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
  useSubmitGate,
} from "ui";

import { reorderSteps } from "@/features/catalog/helpers.ts";

import {
  useArchiveModifierMutation,
  useCreateModifierMutation,
  useReorderModifierMutation,
  useUpdateModifierMutation,
} from "./__common/queries.ts";
import { DeltaField, type DeltaKind } from "./DeltaField.tsx";
import {
  absoluteToEditorString,
  formatDelta,
  type ModifierGroupOutput,
  type ModifierOutput,
  parseAbsoluteDeltaInput,
  parseMultiplierRateInput,
  perMilleToEditorString,
} from "./helpers.ts";

type SheetPage =
  | { view: "list" }
  | { view: "edit"; modifier: ModifierOutput | null };

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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
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
        <span className="tabular-nums text-muted-foreground">
          {formatDelta(mod.delta)}
        </span>
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

function ModifierEditPanel({
  group,
  modifier,
  onBack,
  onSaved,
}: {
  group: ModifierGroupOutput;
  modifier: ModifierOutput | null;
  onBack: () => void;
  onSaved: (msg: string, name: string) => void;
}) {
  const createModifier = useCreateModifierMutation();
  const updateModifier = useUpdateModifierMutation();
  const saving = createModifier.isPending || updateModifier.isPending;
  const [formError, setFormError] = useState<string | null>(null);
  const [deltaError, setDeltaError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: modifier?.name ?? "",
      deltaKind: (modifier?.delta.kind ?? "absolute") as DeltaKind,
      absoluteValue:
        modifier?.delta.kind === "absolute"
          ? absoluteToEditorString(modifier.delta.amountCentavos)
          : "",
      multiplierValue:
        modifier?.delta.kind === "multiplier"
          ? perMilleToEditorString(modifier.delta.perMille)
          : "",
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      setDeltaError(null);

      let delta:
        | { kind: "absolute"; amountCentavos: number }
        | { kind: "multiplier"; perMille: number };

      if (value.deltaKind === "absolute") {
        const parsed = parseAbsoluteDeltaInput(value.absoluteValue);
        if (!parsed.ok) {
          setDeltaError("Enter an amount with up to two decimal places.");
          return;
        }
        if (parsed.value < -100_000 || parsed.value > 100_000) {
          setDeltaError("Amount must be within ±₱1,000.00.");
          return;
        }
        delta = { kind: "absolute", amountCentavos: parsed.value };
      } else {
        const parsed = parseMultiplierRateInput(value.multiplierValue);
        if (!parsed.ok) {
          setDeltaError(
            "Enter a rate with up to three decimal places (e.g. 0.5).",
          );
          return;
        }
        delta = { kind: "multiplier", perMille: parsed.perMille };
      }

      const saved = modifier
        ? await updateModifier.mutateAsync({
            id: modifier.id,
            name: value.name,
            delta,
          })
        : await createModifier.mutateAsync({
            groupId: group.id,
            name: value.name,
            delta,
          });

      if (!saved) {
        setFormError("Couldn't save the modifier.");
        return;
      }
      onSaved(modifier ? "Saved" : "Modifier created", value.name);
    },
  });

  const gate = useSubmitGate(form, { busy: saving, dirty: true });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    if (saving) return;
    gate.submit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={saving}
      className="flex h-full flex-col"
    >
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label="Back to modifiers list"
        >
          <ArrowLeftIcon />
        </Button>
        <h2 className="flex-1 text-lg font-semibold">
          {modifier ? `Edit ${modifier.name}` : `New modifier`}
        </h2>
      </div>
      <div className="scrollbar-slim flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {formError ? (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm"
          >
            {formError}
          </div>
        ) : null}
        <form.Field name="name">
          {(field) => (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="modifier-name">Name</label>
              <Input
                id="modifier-name"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                autoComplete="off"
                placeholder="e.g. Extra Cheese"
              />
            </div>
          )}
        </form.Field>
        <form.Field name="deltaKind">
          {(kindField) => (
            <form.Field
              name={
                kindField.state.value === "absolute"
                  ? "absoluteValue"
                  : "multiplierValue"
              }
            >
              {(valueField) => (
                <DeltaField
                  kind={kindField.state.value}
                  value={valueField.state.value}
                  onKindChange={(k) => {
                    kindField.handleChange(k);
                    setDeltaError(null);
                  }}
                  onValueChange={(v) => {
                    valueField.handleChange(v);
                    setDeltaError(null);
                  }}
                  error={deltaError}
                />
              )}
            </form.Field>
          )}
        </form.Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={saving}
        >
          <XIcon />
          Cancel
        </Button>
        <Button type="submit" aria-disabled={gate.blocked}>
          <CheckIcon />
          Save
        </Button>
      </div>
    </form>
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
  const [archiveTarget, setArchiveTarget] = useState<ModifierOutput | null>(
    null,
  );
  const [pendingItemName, setPendingItemName] = useState<string | null>(null);

  const archiveModifier = useArchiveModifierMutation();
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
                    Modifiers · {group.name}
                  </h2>
                  <SheetClose asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Close"
                    >
                      <XIcon />
                    </Button>
                  </SheetClose>
                </div>
                <div className="scrollbar-slim flex flex-1 flex-col overflow-y-auto p-2">
                  <p className="px-2 pb-2 pt-1 text-sm text-muted-foreground">
                    Drag to reorder. Changes apply immediately.
                  </p>
                  {ordered.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">
                      No modifiers yet.
                    </p>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={ordered.map((m) => m.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {ordered.map((mod) => (
                          <SortableModifierRow
                            key={mod.id}
                            mod={mod}
                            groupArchivedAt={group.archivedAt}
                            canMutate={canMutate}
                            disabled={
                              reorderModifier.isPending || ordered.length < 2
                            }
                            onEdit={(m) =>
                              setPage({ view: "edit", modifier: m })
                            }
                            onArchive={setArchiveTarget}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
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
              <div
                className="flex h-full w-1/2 flex-col overflow-hidden"
                aria-hidden={!inEditMode}
              >
                {inEditMode ? (
                  <ModifierEditPanel
                    key={
                      page.modifier
                        ? `edit-${page.modifier.id}`
                        : `create-${group.id}`
                    }
                    group={group}
                    modifier={page.modifier}
                    onBack={() => setPage({ view: "list" })}
                    onSaved={(msg, name) => {
                      toast(msg);
                      onAnnounce(msg);
                      if (page.view === "edit" && page.modifier === null) {
                        setPendingItemName(name);
                      }
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
              This modifier will be hidden from new orders. You can reactivate
              it later.
            </DialogDescription>
          </DialogHeader>
          {archiveModifier.isError ? (
            <div
              role="alert"
              className="rounded-md bg-status-danger-tint p-3 text-sm"
            >
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
