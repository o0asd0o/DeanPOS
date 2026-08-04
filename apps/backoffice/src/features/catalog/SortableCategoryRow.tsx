import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArchiveIcon, GripVerticalIcon, PencilIcon } from "lucide-react";
import { Button, cn } from "ui";

import type { CategoryOutput } from "./helpers.ts";

export function SortableCategoryRow({
  category,
  selected,
  disabled,
  onSelect,
  onRename,
  onArchive,
}: {
  category: CategoryOutput;
  selected: boolean;
  disabled: boolean;
  onSelect: (category: CategoryOutput) => void;
  onRename: (category: CategoryOutput) => void;
  onArchive: (category: CategoryOutput) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      // design-exempt: dnd-kit needs live transform and transition while dragging
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-1 rounded-md border px-2 py-1.5",
        selected ? "border-primary bg-muted/40" : "border-transparent",
        isDragging && "z-10 bg-background opacity-95 shadow-md",
      )}
    >
      <button
        type="button"
        className="tap-target inline-flex size-9 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Drag category ${category.name}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 truncate px-1 text-left text-sm font-medium"
        onClick={() => onSelect(category)}
      >
        {category.name}
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Rename category ${category.name}`}
        onClick={() => onRename(category)}
        className="tap-target"
      >
        <PencilIcon aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        danger
        aria-label={`Archive category ${category.name}`}
        onClick={() => onArchive(category)}
        className="tap-target"
      >
        <ArchiveIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
