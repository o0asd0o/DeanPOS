import { CheckCircle2Icon, PlusIcon } from "lucide-react";
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from "ui";
import type { Receipt } from "contract/src/contract.ts";

import { formatPeso } from "@/features/helpers.ts";

type Props = { receipt: Receipt; onNewOrder: () => void };

export function ReceiptView({ receipt, onNewOrder }: Props) {
  return (
    <section
      aria-label="Receipt"
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 md:mx-auto md:w-full md:max-w-2xl md:p-6"
    >
      <Card>
        <CardHeader className="items-center text-center">
          <CheckCircle2Icon aria-hidden="true" className="size-10 text-primary" />
          <CardTitle>Sale complete</CardTitle>
          <p className="font-medium">Order {receipt.orderNumber}</p>
          <p className="text-sm text-muted-foreground">
            Device {receipt.deviceCode} · {receipt.deviceName}
          </p>
          <p className="text-sm text-muted-foreground">
            Cashier · {receipt.cashierName ?? "Unknown"}
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {receipt.lines.map((line, index) => (
              <li key={`${line.menuItemName}-${line.variantName}-${index}`} className="space-y-1">
                <div className="flex items-start justify-between gap-4 font-medium">
                  <span>
                    {line.menuItemName}
                    {line.variantName ? ` · ${line.variantName}` : ""} ×{line.quantity}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatPeso(line.lineTotalCentavos)}
                  </span>
                </div>
                {line.modifiers.map((modifier) => (
                  <p key={modifier.id} className="pl-3 text-sm text-muted-foreground">
                    Modifier · {modifier.name}
                  </p>
                ))}
                {line.addOns.map((addOn, addOnIndex) => (
                  <p
                    key={`${addOn.id}-${addOnIndex}`}
                    className="pl-3 text-sm text-muted-foreground"
                  >
                    Add-on · {addOn.name}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-center justify-between gap-4 text-lg font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatPeso(receipt.totalCentavos)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Amount tendered</span>
            <span className="tabular-nums">{formatPeso(receipt.amountTenderedCentavos)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Change</span>
            <span className="tabular-nums">{formatPeso(receipt.changeCentavos)}</span>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="button" className="w-full" size="lg" onClick={onNewOrder}>
            <PlusIcon aria-hidden="true" />
            New order
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
}
