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
      className="flex h-full w-full min-h-0 flex-col gap-0 p-3 md:w-72 md:shrink-0"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Choose a menu item to start.</p>
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
      <div className="flex shrink-0 items-center justify-between px-2 py-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground">TOTAL</span>
        <span className="text-xl font-semibold tabular-nums">{formatPeso(total)}</span>
      </div>
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={lines.length === 0}
        onClick={onPay}
      >
        Pay {formatPeso(total)}
      </Button>
    </Card>
  );
}
