import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import { GripVerticalIcon } from "lucide-react";
import { Badge, cn, TableCell, TableRow } from "ui";

import { formatCentavos, type MenuItemOutput } from "@/features/catalog/helpers.ts";
import { MenuItemActions } from "./MenuItemActions.tsx";

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
      className={cn("last:!border-b", isDragging && "relative z-10 bg-background shadow-md")}
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
      <TableCell className="tabular-nums">{formatCentavos(item.priceCentavos)}</TableCell>
      <TableCell className="tabular-nums">
        <Link
          to="/catalog/$id"
          params={{ id: item.id }}
          className="underline-offset-4 hover:underline"
        >
          {item.activeVariantCount}
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant={item.activeVariantCount > 0 ? "success" : "warning"}>
          {item.activeVariantCount > 0 ? "Live" : "Draft"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <MenuItemActions item={item} onArchive={onArchive} />
      </TableCell>
    </TableRow>
  );
}
