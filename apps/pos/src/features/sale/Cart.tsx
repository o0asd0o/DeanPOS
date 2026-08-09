import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "ui";

import type { Draft } from "./draft-store.ts";
import { formatPeso } from "./helpers.ts";

type Props = {
  draft: Draft | null;
  onClear: () => void;
  onEdit: (line: Draft["lines"][number]) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
};

export function Cart({ draft, onClear, onEdit, onQuantityChange, onRemove }: Props) {
  const lines = draft?.lines ?? [];
  const total = draft?.totalCentavos ?? 0;
  return (
    <Card className="flex min-h-0 flex-col md:w-96 md:shrink-0">
      <CardHeader>
        <CardTitle>Current order</CardTitle>
        <CardDescription>
          {draft ? `Draft ${draft.id.slice(0, 8)}` : "Ready for the next sale"}
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">{lines.length} items</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-32 flex-col gap-2 overflow-y-auto">
        {lines.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Choose a menu item to start an order.
          </p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-3 py-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 flex-col items-start text-left"
                onClick={() => onEdit(line)}
              >
                <span>
                  {line.quantity} × {line.menuItemName}
                  {line.variantName ? ` · ${line.variantName}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">Edit modifiers and add-ons</span>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-medium">{formatPeso(line.totalCentavos)}</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    aria-label={`Decrease ${line.menuItemName} quantity`}
                    onClick={() => onQuantityChange(line.id, Math.max(1, line.quantity - 1))}
                  >
                    −
                  </Button>
                  <span aria-label={`${line.menuItemName} quantity`}>{line.quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    aria-label={`Increase ${line.menuItemName} quantity`}
                    onClick={() => onQuantityChange(line.id, line.quantity + 1)}
                  >
                    +
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    danger
                    aria-label={`Remove ${line.menuItemName}`}
                    onClick={() => onRemove(line.id)}
                  >
                    ×
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <div className="flex w-full items-center justify-between rounded-xl bg-secondary px-4 py-3">
          <span className="text-xs font-semibold tracking-wide text-secondary-foreground">
            TOTAL
          </span>
          <span className="text-lg font-semibold text-secondary-foreground">
            {formatPeso(total)}
          </span>
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={onClear}>
          Clear order
        </Button>
        <Button type="button" size="lg" className="w-full" disabled={lines.length === 0}>
          Pay {formatPeso(total)}
        </Button>
      </CardFooter>
    </Card>
  );
}
