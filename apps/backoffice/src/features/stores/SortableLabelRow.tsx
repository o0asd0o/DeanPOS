import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, XIcon } from "lucide-react";
import { Button, cn, Input } from "ui";

import type { LabelRow } from "./helpers.ts";

// One draggable table-label row (record 039). Only the grip lifts the row,
// so typing in the input never starts a drag. The row is keyed by `row.id`,
// not index, so the focused handle moves with its row (039 §1).
export function SortableLabelRow({
  row,
  index,
  disabled,
  onValueChange,
  onRemove,
  inputRef,
}: {
  row: LabelRow;
  index: number;
  disabled: boolean;
  onValueChange: (value: string) => void;
  onRemove: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id,
    disabled,
  });
  const n = index + 1;

  return (
    <div
      ref={setNodeRef}
      data-label-row
      // design-exempt: dnd-kit needs live transform and transition while dragging
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1",
        isDragging && "relative z-10 rounded-md bg-background shadow-md",
      )}
    >
      <button
        type="button"
        className="tap-target inline-flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Drag label ${n}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon aria-hidden="true" className="size-4" />
      </button>
      <Input
        placeholder={`Table ${n}`}
        ref={inputRef}
        aria-label={`Table label ${n}`}
        className="flex-1"
        value={row.value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="tap-target"
        aria-label={`Remove label ${n}`}
        onClick={onRemove}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
