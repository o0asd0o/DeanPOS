import { Button, Card, CardContent, CardFooter } from "ui";

import type { Draft } from "./draft-store.ts";
import { formatPeso } from "./helpers.ts";

type Props = {
  draft: Draft | null;
  optionNames: ReadonlyMap<string, string>;
  onEdit: (line: Draft["lines"][number]) => void;
};

export function Cart({ draft, optionNames, onEdit }: Props) {
  const lines = draft?.lines ?? [];
  const total = draft?.totalCentavos ?? 0;
  return (
    <Card className="flex h-full min-h-0 flex-col md:w-72 md:shrink-0">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {lines.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Choose a menu item to start an order.
          </p>
        ) : (
          lines.map((line) => {
            const modifiers = line.modifierIds
              .map((id) => optionNames.get(id))
              .filter((name): name is string => Boolean(name));
            const addOns = [...new Set(line.addOnIds)].map((id) => {
              const count = line.addOnIds.filter((entry) => entry === id).length;
              return `${count}× ${optionNames.get(id) ?? "Add-on"}`;
            });
            return (
              <Button
                key={line.id}
                type="button"
                variant="ghost"
                className="min-h-11 w-full justify-between whitespace-normal"
                onClick={() => onEdit(line)}
              >
                <span className="flex min-w-0 flex-col items-start gap-1 text-left">
                  <span>
                    {line.quantity} × {line.menuItemName}
                    {line.variantName ? ` · ${line.variantName}` : ""}
                  </span>
                  {modifiers.map((name) => (
                    <span key={name} className="text-xs text-muted-foreground">
                      {name}
                    </span>
                  ))}
                  {addOns.map((label) => (
                    <span key={label} className="text-xs text-muted-foreground">
                      + {label}
                    </span>
                  ))}
                </span>
                <span className="shrink-0 font-medium">{formatPeso(line.totalCentavos)}</span>
              </Button>
            );
          })
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
        <Button type="button" size="lg" className="w-full" disabled={lines.length === 0}>
          Pay {formatPeso(total)}
        </Button>
      </CardFooter>
    </Card>
  );
}
