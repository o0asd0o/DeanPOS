import { CheckIcon, ChevronLeftIcon } from "lucide-react";
import { useState } from "react";
import { Button, Card, Input } from "ui";

import type { Draft } from "@/features/sale/draft-store.ts";
import { formatPeso } from "@/features/helpers.ts";
import type { SaleCatalog } from "@/features/sale/types.ts";

type Props = {
  draft: Draft;
  catalog: SaleCatalog;
  pending: boolean;
  error?: string | null;
  onBack: () => void;
  onSubmit: (amountTenderedCentavos: number) => void | Promise<void>;
};

const quickTenderPesos = [100, 200, 500, 1_000] as const;

function parseTenderedCentavos(value: string): number | null {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return null;
  const [pesos, fraction = ""] = value.split(".");
  const centavos = Number(pesos) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) && centavos <= 2_147_483_647 ? centavos : null;
}

function formatTenderInput(centavos: number): string {
  const pesos = Math.floor(centavos / 100);
  const remainder = centavos % 100;
  return remainder === 0 ? String(pesos) : `${pesos}.${String(remainder).padStart(2, "0")}`;
}

export function PaymentPanel({ draft, catalog, pending, error, onBack, onSubmit }: Props) {
  const [tenderedInput, setTenderedInput] = useState("");
  const tenderedCentavos = parseTenderedCentavos(tenderedInput);
  const changeCentavos = Math.max(0, (tenderedCentavos ?? 0) - draft.totalCentavos);
  const canComplete = tenderedCentavos !== null && tenderedCentavos >= draft.totalCentavos;
  const optionNames = new Map(
    catalog.menuItems.flatMap((item) => [
      ...item.modifierGroups.flatMap((group) =>
        group.modifiers.map((modifier) => [modifier.id, modifier.name] as const),
      ),
      ...item.addOns.map((addOn) => [addOn.id, addOn.name] as const),
    ]),
  );

  return (
    <form
      aria-label="Payment"
      role="region"
      className="grid min-h-0 flex-1 gap-2 overflow-y-auto bg-muted/40 p-2 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canComplete && !pending) void onSubmit(tenderedCentavos);
      }}
    >
      <Card className="flex flex-col gap-5 p-4 md:p-6">
        <section
          aria-labelledby="amount-due-heading"
          className="rounded-xl bg-muted p-5 text-center"
        >
          <h2
            id="amount-due-heading"
            className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Amount due
          </h2>
          <p className="mt-2 text-4xl font-semibold tabular-nums">
            {formatPeso(draft.totalCentavos)}
          </p>
        </section>

        <label className="grid gap-2 text-sm font-medium" htmlFor="cash-tendered">
          Cash tendered
          <Input
            id="cash-tendered"
            aria-label="Cash tendered"
            inputMode="decimal"
            autoComplete="off"
            className="h-16 text-center text-2xl tabular-nums"
            placeholder="0"
            value={tenderedInput}
            onChange={(event) => {
              const next = event.target.value;
              if (next === "" || /^\d+(?:\.\d{0,2})?$/.test(next)) setTenderedInput(next);
            }}
          />
        </label>

        <div aria-label="Quick tender" role="group" className="grid grid-cols-5 gap-2">
          {quickTenderPesos.map((pesos) => (
            <Button
              key={pesos}
              type="button"
              variant="outline"
              className="h-12 px-1 tabular-nums"
              aria-label={`Tender ₱${pesos}`}
              onClick={() => setTenderedInput(String(pesos))}
            >
              {pesos}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            className="h-12 px-1"
            aria-label="Tender exact amount"
            onClick={() => setTenderedInput(formatTenderInput(draft.totalCentavos))}
          >
            Exact
          </Button>
        </div>

        <section aria-labelledby="change-heading" className="rounded-xl bg-muted p-4 text-center">
          <h2
            id="change-heading"
            className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Change
          </h2>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{formatPeso(changeCentavos)}</p>
        </section>
      </Card>

      <Card className="flex min-h-0 flex-col gap-4 p-4 md:p-6">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <h2 className="font-semibold">Order summary</h2>
          <div className="mt-3 grid gap-3">
            {draft.lines.map((line) => {
              const addOns = [...new Set(line.addOnIds)].map((id) => ({
                id,
                name: optionNames.get(id) ?? "Add-on",
                count: line.addOnIds.filter((entry) => entry === id).length,
              }));
              return (
                <div key={line.id} className="grid gap-1">
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <span>
                      {line.quantity}× {line.menuItemName}
                      {line.variantName ? ` · ${line.variantName}` : ""}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatPeso(line.totalCentavos)}
                    </span>
                  </div>
                  {line.modifierIds.map((id) => (
                    <p key={id} className="text-xs text-muted-foreground">
                      {optionNames.get(id) ?? "Modifier"}
                    </p>
                  ))}
                  {addOns.map((addOn) => (
                    <p key={addOn.id} className="text-xs text-muted-foreground">
                      + {addOn.count}× {addOn.name}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-muted p-4">
          <span className="text-sm font-semibold">Amount due</span>
          <span className="text-2xl font-semibold tabular-nums">
            {formatPeso(draft.totalCentavos)}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            <ChevronLeftIcon aria-hidden="true" />
            Back to order
          </Button>
          <Button type="submit" size="lg" disabled={!canComplete || pending}>
            <CheckIcon aria-hidden="true" />
            {pending ? "Completing sale…" : "Complete sale"}
          </Button>
        </div>
        {error ? <p role="alert">{error}</p> : null}
      </Card>
    </form>
  );
}
