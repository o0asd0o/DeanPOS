import { ShoppingBagIcon } from "lucide-react";
import { Button, Card } from "ui";

import { formatPeso } from "@/features/helpers.ts";
import type { Draft } from "./draft-store.ts";

type Props = {
  ariaLabel?: string;
  draft: Draft | null;
  optionNames: ReadonlyMap<string, string>;
  onEdit: (line: Draft["lines"][number]) => void;
  onPay: () => void;
};

export function Cart({ ariaLabel, draft, optionNames, onEdit, onPay }: Props) {
  const lines = draft?.lines ?? [];
  const total = draft?.totalCentavos ?? 0;
  return (
    <Card
      aria-label={ariaLabel}
      role={ariaLabel ? "region" : undefined}
      data-cart-target="desktop"
      className="flex h-full w-full min-h-0 flex-col gap-0 overflow-hidden p-0 md:w-80 md:shrink-0"
    >
      <div className="flex shrink-0 items-start justify-between p-4">
        <div>
          <h2 className="font-semibold">Current order</h2>
          <p className="mt-1 text-sm text-muted-foreground">Review items before payment.</p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold tabular-nums">
          {lines.length} {lines.length === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {lines.length === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 px-5 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <ShoppingBagIcon aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Your order is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">Choose a menu item to start.</p>
            </div>
          </div>
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
                className="h-auto w-full items-start justify-between gap-2 rounded-lg px-2 py-2 whitespace-normal active:scale-98 active:bg-secondary"
                onClick={() => onEdit(line)}
              >
                <span className="flex min-w-0 gap-2 text-left">
                  <span className="shrink-0 font-semibold tabular-nums">{line.quantity}×</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {line.menuItemName}
                      {line.variantName ? ` · ${line.variantName}` : ""}
                    </span>
                    {modifiers.map((name) => (
                      <span key={name} className="block text-xs text-muted-foreground">
                        {name}
                      </span>
                    ))}
                    {addOns.map((label) => (
                      <span key={label} className="block text-xs text-muted-foreground">
                        + {label}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatPeso(line.totalCentavos)}
                </span>
              </Button>
            );
          })
        )}
      </div>
      <div className="shrink-0 bg-primary p-3 text-primary-foreground">
        <div className="mb-3 flex items-end justify-between px-1">
          <span className="text-sm font-medium text-primary-foreground/70">Total</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatPeso(total)}
          </span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full bg-white!"
          disabled={lines.length === 0}
          onClick={onPay}
        >
          Pay {formatPeso(total)}
        </Button>
      </div>
    </Card>
  );
}
