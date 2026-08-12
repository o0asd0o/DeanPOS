import { CheckIcon, ChevronLeftIcon, EraserIcon } from "lucide-react";
import { useState } from "react";
import { Button, Card, Input } from "ui";

import type { Draft } from "@/features/sale/draft-store.ts";
import { formatPeso } from "@/features/helpers.ts";
import type { SaleCatalog } from "@/features/sale/types.ts";
import { PaymentMethodChooser } from "./PaymentMethodChooser.tsx";

type Props = {
  draft: Draft;
  catalog: SaleCatalog;
  pending: boolean;
  error?: string | null;
  onBack: () => void;
  onSubmit: (paymentMethodId: string, amountTenderedCentavos: number) => void | Promise<void>;
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
  const [selectedMethodId, setSelectedMethodId] = useState(
    () =>
      catalog.paymentMethods.find((method) => method.kind === "cash")?.id ??
      catalog.paymentMethods[0]!.id,
  );
  const [tenderedInput, setTenderedInput] = useState("");
  const selectedMethod =
    catalog.paymentMethods.find((method) => method.id === selectedMethodId) ??
    catalog.paymentMethods[0]!;
  const isCash = selectedMethod.kind === "cash";
  const tenderedCentavos = parseTenderedCentavos(tenderedInput);
  const changeCentavos = Math.max(0, (tenderedCentavos ?? 0) - draft.totalCentavos);
  const canComplete =
    tenderedCentavos !== null &&
    (isCash ? tenderedCentavos >= draft.totalCentavos : tenderedCentavos === draft.totalCentavos);
  const addQuickTender = (pesos: number) => {
    const nextTenderedCentavos = (parseTenderedCentavos(tenderedInput) ?? 0) + pesos * 100;
    if (nextTenderedCentavos <= 2_147_483_647) {
      setTenderedInput(formatTenderInput(nextTenderedCentavos));
    }
  };
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
      className="@container/payment min-h-0 flex-1 overflow-y-auto bg-background p-2 md:p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canComplete && !pending) void onSubmit(selectedMethod.id, tenderedCentavos);
      }}
    >
      <div className="grid min-h-full gap-3 @3xl/payment:grid-cols-3">
        <Card className="min-h-0 gap-0 overflow-hidden p-0 @3xl/payment:col-span-1">
          <div className="flex shrink-0 items-start justify-between p-4 md:p-5">
            <div>
              <h2 className="font-semibold">Order summary</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review the ticket before payment.
              </p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold whitespace-nowrap tabular-nums">
              {draft.lines.length} {draft.lines.length === 1 ? "line" : "lines"}
            </span>
          </div>

          <div className="min-h-0 overflow-y-auto px-4 pb-4 md:px-5">
            <div className="grid gap-4">
              {draft.lines.map((line) => {
                const addOns = [...new Set(line.addOnIds)].map((id) => ({
                  id,
                  name: optionNames.get(id) ?? "Add-on",
                  count: line.addOnIds.filter((entry) => entry === id).length,
                }));
                return (
                  <div key={line.id} className="grid gap-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium">
                        {line.quantity}× {line.menuItemName}
                        {line.variantName ? ` · ${line.variantName}` : ""}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatPeso(line.totalCentavos)}
                      </span>
                    </div>
                    {line.modifierIds.map((id) => (
                      <p key={id} className="text-sm text-muted-foreground">
                        {optionNames.get(id) ?? "Modifier"}
                      </p>
                    ))}
                    {addOns.map((addOn) => (
                      <p key={addOn.id} className="text-sm text-muted-foreground">
                        + {addOn.count}× {addOn.name}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mx-4 mb-4 flex items-end justify-between rounded-xl bg-secondary p-4 md:mx-5 md:mb-5">
            <span className="text-sm font-medium text-muted-foreground">Total</span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatPeso(draft.totalCentavos)}
            </span>
          </div>
        </Card>

        <Card className="@container/tender min-h-0 gap-0 overflow-hidden p-0 @3xl/payment:col-span-2">
          <div className="grid gap-4 bg-secondary p-5 text-foreground @xl/tender:grid-cols-2">
            <div aria-labelledby="amount-due-heading" className="bg-secondary">
              <h2 id="amount-due-heading" className="text-sm font-medium text-muted-foreground">
                Amount due
              </h2>
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                {formatPeso(draft.totalCentavos)}
              </p>
            </div>
            {catalog.paymentMethods.length > 1 ? (
              <PaymentMethodChooser
                methods={catalog.paymentMethods}
                selectedId={selectedMethod.id}
                onSelect={(methodId) => {
                  setSelectedMethodId(methodId);
                  const method = catalog.paymentMethods.find(
                    (candidate) => candidate.id === methodId,
                  );
                  setTenderedInput(
                    method?.kind === "recorded" ? formatTenderInput(draft.totalCentavos) : "",
                  );
                }}
              />
            ) : null}
          </div>

          <div className="flex flex-1 flex-col gap-5 p-4 md:p-5">
            <div className="grid gap-2 text-sm font-medium">
              <label htmlFor={isCash ? "cash-tendered" : "recorded-amount"}>
                {isCash ? "Cash tendered" : "Amount recorded"}
              </label>
              <div className="relative">
                <Input
                  id={isCash ? "cash-tendered" : "recorded-amount"}
                  aria-label={isCash ? "Cash tendered" : "Amount recorded"}
                  inputMode="decimal"
                  autoComplete="off"
                  className="h-16 pl-14 pr-4 text-right text-3xl! font-semibold tabular-nums placeholder:text-muted-foreground"
                  placeholder="0"
                  value={tenderedInput}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next === "" || /^\d+(?:\.\d{0,2})?$/.test(next)) setTenderedInput(next);
                  }}
                />
                {isCash && tenderedInput ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1/2 left-3 -translate-y-1/2"
                    aria-label="Clear cash tendered"
                    onClick={() => setTenderedInput("")}
                  >
                    <EraserIcon aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </div>

            {isCash ? (
              <div
                aria-label="Quick tender"
                role="group"
                className="grid grid-cols-2 gap-2 @xs/tender:grid-cols-3 @xl/tender:grid-cols-5"
              >
                {quickTenderPesos.map((pesos) => (
                  <Button
                    key={pesos}
                    type="button"
                    variant="outline"
                    className="h-12 bg-card px-2 shadow-none tabular-nums"
                    aria-label={`Tender ₱${pesos}`}
                    onClick={() => addQuickTender(pesos)}
                  >
                    {pesos}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 bg-card px-2 shadow-none"
                  aria-label="Tender exact amount"
                  onClick={() => setTenderedInput(formatTenderInput(draft.totalCentavos))}
                >
                  Exact
                </Button>
              </div>
            ) : (
              <p className="rounded-xl bg-secondary p-4 text-sm text-muted-foreground">
                A recorded tender authorises nothing — no gateway, no QR, no settlement.
              </p>
            )}

            {isCash ? (
              <div
                aria-labelledby="change-heading"
                className="flex items-end justify-between rounded-xl bg-secondary p-4"
              >
                <h2 id="change-heading" className="text-sm font-medium text-muted-foreground">
                  Change
                </h2>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {formatPeso(changeCentavos)}
                </p>
              </div>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="px-4 pb-4 text-sm font-medium text-status-danger-tone md:px-5"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-auto shrink-0 bg-card p-4">
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
          </div>
        </Card>
      </div>
    </form>
  );
}
