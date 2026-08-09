import { Link } from "@tanstack/react-router";
import { ArchiveIcon, EllipsisVerticalIcon, PencilIcon, RotateCcwIcon } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "ui";

import type { MenuItemOutput } from "@/features/catalog/helpers.ts";

export function MenuItemActions({
  item,
  onArchive,
  onReactivate,
}: {
  item: MenuItemOutput;
  onArchive?: (item: MenuItemOutput) => void;
  onReactivate?: (item: MenuItemOutput) => void;
}) {
  const archived = item.archivedAt !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="tap-target"
          aria-label={`Actions for ${item.name}`}
        >
          <EllipsisVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={(event) => event.preventDefault()}>
        {archived ? (
          <DropdownMenuItem onSelect={() => onReactivate?.(item)}>
            <RotateCcwIcon />
            Reactivate
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link to="/catalog/$id" params={{ id: item.id }}>
                <PencilIcon />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onArchive?.(item)}
            >
              <ArchiveIcon />
              Archive
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
