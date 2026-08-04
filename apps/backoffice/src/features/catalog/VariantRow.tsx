import { ArchiveIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Badge, Button, TableCell, TableRow } from "ui";

import { formatCentavos, type VariantOutput } from "./helpers.ts";

export function VariantRow({
  variant,
  index,
  total,
  reordering,
  onEdit,
  onArchive,
  onReactivate,
  onMove,
}: {
  variant: VariantOutput;
  index: number;
  total: number;
  reordering: boolean;
  onEdit: (variant: VariantOutput) => void;
  onArchive: (variant: VariantOutput) => void;
  onReactivate: (variant: VariantOutput) => void;
  onMove: (variant: VariantOutput, direction: "up" | "down") => void;
}) {
  const active = variant.archivedAt === null;
  return (
    <TableRow>
      <TableCell className="w-24">
        {active ? (
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="tap-target"
              aria-label={`Move variant ${variant.name} up`}
              disabled={reordering || index === 0}
              onClick={() => onMove(variant, "up")}
            >
              <ChevronUpIcon aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="tap-target"
              aria-label={`Move variant ${variant.name} down`}
              disabled={reordering || index >= total - 1}
              onClick={() => onMove(variant, "down")}
            >
              <ChevronDownIcon aria-hidden="true" />
            </Button>
          </div>
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
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="tap-target"
              onClick={() => onReactivate(variant)}
            >
              Reactivate
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
