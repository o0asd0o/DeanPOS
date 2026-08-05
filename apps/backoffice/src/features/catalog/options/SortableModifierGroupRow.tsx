import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArchiveIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  GripVerticalIcon,
  PencilIcon,
  PlusIcon,
  PowerOffIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Badge, Button, cn, TableCell, TableRow } from "ui";

import { formatDelta, type ModifierGroupOutput, type ModifierOutput, SELECTION_RULE_LABEL } from "./helpers.ts";
import { useReorderModifierMutation } from "./__common/queries.ts";

export function SortableModifierGroupRow({
  group,
  disabled,
  editingGroupId,
  canMutate,
  onEditGroup,
  onArchiveGroup,
  onReactivateGroup,
  onAddModifier,
  onEditModifier,
  onArchiveModifier,
}: {
  group: ModifierGroupOutput;
  disabled: boolean;
  editingGroupId: string | null;
  canMutate: boolean;
  onEditGroup: (group: ModifierGroupOutput) => void;
  onArchiveGroup: (group: ModifierGroupOutput) => void;
  onReactivateGroup: (group: ModifierGroupOutput) => void;
  onAddModifier: (group: ModifierGroupOutput) => void;
  onEditModifier: (group: ModifierGroupOutput, modifier: ModifierOutput) => void;
  onArchiveModifier: (modifier: ModifierOutput) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    disabled,
  });

  const reorderModifier = useReorderModifierMutation();

  const activeMods = group.modifiers
    .filter((m) => !m.archivedAt)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  return (
    <TableRow
      ref={setNodeRef}
      // design-exempt: dnd-kit needs live transform and transition while dragging
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 bg-background shadow-md")}
      data-state={editingGroupId === group.id ? "selected" : undefined}
    >
      <TableCell className="w-10">
        <button
          type="button"
          className="tap-target inline-flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Drag modifier group ${group.name}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon aria-hidden="true" className="size-4" />
        </button>
      </TableCell>
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
                  <span className="tabular-nums text-muted-foreground">{formatDelta(mod.delta)}</span>
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
                      onClick={() => void reorderModifier.mutateAsync({ id: mod.id, direction: "up" })}
                    >
                      <ChevronUpIcon />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`Move ${mod.name} down in ${group.name}`}
                      disabled={modIndex === activeMods.length - 1 || reorderModifier.isPending}
                      onClick={() => void reorderModifier.mutateAsync({ id: mod.id, direction: "down" })}
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
                <Button type="button" size="sm" variant="outline" onClick={() => onEditGroup(group)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onAddModifier(group)}>
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
              <Button type="button" size="sm" variant="ghost" onClick={() => onReactivateGroup(group)}>
                <RotateCcwIcon />
                Reactivate
              </Button>
            )}
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
