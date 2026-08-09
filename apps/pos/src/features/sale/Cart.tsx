import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from "ui";

import type { Draft } from "./draft-store.ts";
import { formatPeso } from "./helpers.ts";

type Props = { draft: Draft | null; onClear: () => void };

export function Cart({ draft, onClear }: Props) {
  const lines = draft?.lines ?? [];
  const total = draft?.totalCentavos ?? 0;
  return (
    <Card className="flex min-h-0 flex-col md:w-96 md:shrink-0">
      <CardHeader>
        <CardTitle>Order {draft ? draft.id.slice(0, 8) : ""}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {lines.length === 0 ? (
          <p className="text-muted-foreground">Your cart is empty</p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-2">
              <span>
                {line.menuItemName}
                {line.variantName ? ` · ${line.variantName}` : ""}
              </span>
              <span>{formatPeso(line.unitPriceCentavos)}</span>
            </div>
          ))
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <div className="flex w-full justify-between font-semibold">
          <span>Total</span>
          <span>{formatPeso(total)}</span>
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={onClear}>
          Clear order
        </Button>
        <Button type="button" className="w-full" disabled={lines.length === 0}>
          Pay {formatPeso(total)}
        </Button>
      </CardFooter>
    </Card>
  );
}
