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

type Props = { draft: Draft | null; onClear: () => void };

export function Cart({ draft, onClear }: Props) {
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
              <span>
                {line.menuItemName}
                {line.variantName ? ` · ${line.variantName}` : ""}
              </span>
              <span className="shrink-0 font-medium">{formatPeso(line.unitPriceCentavos)}</span>
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
