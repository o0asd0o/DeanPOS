import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArchiveIcon, GripVerticalIcon, RotateCcwIcon } from "lucide-react";
import { Badge, Button, cn, TableCell, TableRow } from "ui";

import { type ModifierGroupOutput, SELECTION_RULE_LABEL } from "./helpers.ts";

export function SortableModifierGroupRow({
  group,
  disabled,
  editingGroupId,
  canMutate,
  onEditGroup,
  onArchiveGroup,
  onReactivateGroup,
  onOpenModifiers,
}: {
  group: ModifierGroupOutput;
  disabled: boolean;
  editingGroupId: string | null;
  canMutate: boolean;
  onEditGroup: (group: ModifierGroupOutput) => void;
  onArchiveGroup: (group: ModifierGroupOutput) => void;
  onReactivateGroup: (group: ModifierGroupOutput) => void;
  onOpenModifiers: (group: ModifierGroupOutput) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: group.id,
    disabled,
  });

  const activeModCount = group.modifiers.filter((m) => !m.archivedAt).length;

  return (
    <TableRow
      ref={setNodeRef}
      // design-exempt: dnd-kit needs live transform and transition while dragging
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "last:border-b!",
        isDragging && "relative z-10 bg-background shadow-md",
      )}
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
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="tabular-nums"
          onClick={() => onOpenModifiers(group)}
        >
          {activeModCount} modifier{activeModCount !== 1 ? "s" : ""}
        </Button>
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
                  size="sm"
                  variant="outline"
                  onClick={() => onEditGroup(group)}
                >
                  Edit
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
}
