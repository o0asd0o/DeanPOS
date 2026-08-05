import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import { ArchiveIcon, GripVerticalIcon } from "lucide-react";
import { Badge, Button, cn, TableCell, TableRow } from "ui";

import type { MenuItemOutput } from "@/features/catalog/helpers.ts";

export function SortableMenuItemRow({
  item,
  disabled,
  onArchive,
}: {
  item: MenuItemOutput;
  disabled: boolean;
  onArchive: (item: MenuItemOutput) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
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
        <button
          type="button"
          className="tap-target inline-flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Drag menu item ${item.name}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon aria-hidden="true" className="size-4" />
        </button>
      </TableCell>
      <TableCell className="font-medium">
        <Link
          to="/catalog/$id"
          params={{ id: item.id }}
          className="underline-offset-4 hover:underline"
        >
          {item.name}
        </Link>
      </TableCell>
      <TableCell>
        {item.sellable ? (
          <Badge variant="success">Sellable</Badge>
        ) : (
          <Badge variant="warning">Not sellable — no variant</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="sm" className="tap-target" asChild>
            <Link to="/catalog/$id" params={{ id: item.id }}>
              {item.sellable ? "Edit" : "Add a variant"}
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            danger
            aria-label={`Archive menu item ${item.name}`}
            onClick={() => onArchive(item)}
            className="tap-target"
          >
            <ArchiveIcon aria-hidden="true" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
