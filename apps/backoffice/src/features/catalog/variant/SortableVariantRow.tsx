import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArchiveIcon, GripVerticalIcon } from "lucide-react";
import { Badge, Button, cn, TableCell, TableRow } from "ui";

import { formatCentavos, type VariantOutput } from "@/features/catalog/helpers.ts";

export function SortableVariantRow({
  variant,
  disabled,
  onEdit,
  onArchive,
  onReactivate,
}: {
  variant: VariantOutput;
  disabled: boolean;
  onEdit: (variant: VariantOutput) => void;
  onArchive: (variant: VariantOutput) => void;
  onReactivate?: (variant: VariantOutput) => void;
}) {
  const active = variant.archivedAt === null;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: variant.id,
    disabled: disabled || !active,
  });

  return (
    <TableRow
      ref={setNodeRef}
      // design-exempt: dnd-kit needs live transform and transition while dragging
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "relative z-10 bg-background shadow-md")}
    >
      <TableCell className="w-10">
        {active ? (
          <button
            type="button"
            className="tap-target inline-flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Drag variant ${variant.name}`}
            disabled={disabled}
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </TableCell>
      <TableCell className="font-medium">{variant.name}</TableCell>
      <TableCell className="tabular-nums">{formatCentavos(variant.priceCentavos)}</TableCell>
      <TableCell>
        {active ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="secondary">Archived</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {active ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="tap-target"
                onClick={() => onEdit(variant)}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                danger
                aria-label={`Archive variant ${variant.name}`}
                className="tap-target"
                onClick={() => onArchive(variant)}
              >
                <ArchiveIcon aria-hidden="true" />
              </Button>
            </>
          ) : onReactivate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="tap-target"
              onClick={() => onReactivate(variant)}
            >
              Reactivate
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
