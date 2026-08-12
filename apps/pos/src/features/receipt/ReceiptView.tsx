import { CheckCircle2Icon, PlusIcon } from "lucide-react";
import { Button } from "ui";
import type { Receipt } from "contract/src/contract.ts";
import {
  centavosToMillicentavos,
  roundLineTotal,
  vatBackout,
} from "../../../../../packages/schemas/src/money.ts";
import type { Centavos } from "../../../../../packages/schemas/src/money.ts";

import { formatPeso } from "@/features/helpers.ts";

type Props = { receipt: Receipt; onNewOrder: () => void };

export function ReceiptView({ receipt, onNewOrder }: Props) {
  const isCash = receipt.paymentMethodKind === "cash";
  const vatCentavos =
    receipt.vatRatePercent === null
      ? null
      : roundLineTotal(
          vatBackout(
            centavosToMillicentavos(receipt.totalCentavos as Centavos),
            receipt.vatRatePercent,
          ).vat,
        );

  return (
    <section
      aria-label="Receipt"
      className="flex min-h-0 flex-1 items-start overflow-y-auto p-2 sm:p-4"
    >
      <article
        aria-label={`Order ${receipt.orderNumber} receipt`}
        className="mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-card text-card-foreground shadow-sm"
      >
        <header className="px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-status-success-tone">
              <CheckCircle2Icon aria-hidden="true" className="size-4" />
              Sale complete
            </span>
            <span className="font-mono text-[0.6875rem] font-medium text-muted-foreground">
              {receipt.paymentMethodName.toUpperCase()} · PAID
            </span>
          </div>

          <p className="mt-2 font-mono text-xl font-bold tracking-tight">
            Order {receipt.orderNumber}
          </p>

          <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
            <p>
              Device {receipt.deviceCode} · {receipt.deviceName}
            </p>
            <p>Cashier · {receipt.cashierName ?? "Unknown"}</p>
            <p>Payment method · {receipt.paymentMethodName}</p>
          </div>
        </header>

        <div className="border-y border-dashed px-4 py-3">
          <ul className="space-y-3">
            {receipt.lines.map((line, index) => (
              <li key={`${line.menuItemName}-${line.variantName}-${index}`}>
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="min-w-0 font-medium">
                    {line.menuItemName}
                    {line.variantName ? ` · ${line.variantName}` : ""} ×{line.quantity}
                  </span>
                  <span className="shrink-0 font-mono font-semibold">
                    {formatPeso(line.lineTotalCentavos)}
                  </span>
                </div>
                {line.modifiers.map((modifier) => (
                  <p key={modifier.id} className="mt-0.5 text-xs text-muted-foreground">
                    Modifier · {modifier.name}
                  </p>
                ))}
                {line.addOns.map((addOn, addOnIndex) => (
                  <p
                    key={`${addOn.id}-${addOnIndex}`}
                    className="mt-0.5 text-xs text-muted-foreground"
                  >
                    Add-on · {addOn.name}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </div>

        <div className="px-4 py-3">
          <dl className="space-y-1.5 text-sm">
            {vatCentavos !== null ? (
              <div className="flex items-center justify-between gap-4 text-muted-foreground">
                <dt>VAT ({receipt.vatRatePercent}%)</dt>
                <dd className="font-mono">{formatPeso(vatCentavos)}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4 font-semibold">
              <dt>Total</dt>
              <dd className="font-mono">{formatPeso(receipt.totalCentavos)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 text-muted-foreground">
              <dt>{isCash ? "Amount tendered" : "Amount paid"}</dt>
              <dd className="font-mono">{formatPeso(receipt.amountTenderedCentavos)}</dd>
            </div>
            {isCash ? (
              <div className="mt-2 flex items-center justify-between gap-4 rounded-lg bg-status-success-tint px-3 py-2 font-semibold text-status-success-tone">
                <dt>Change</dt>
                <dd className="font-mono text-base">{formatPeso(receipt.changeCentavos)}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <footer className="border-t px-4 py-3">
          <Button type="button" className="w-full" onClick={onNewOrder}>
            <PlusIcon aria-hidden="true" />
            New order
          </Button>
        </footer>
      </article>
    </section>
  );
}
