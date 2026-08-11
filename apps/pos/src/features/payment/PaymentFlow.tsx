import type { Draft } from "@/features/sale/draft-store.ts";
import type { SaleCatalog } from "@/features/sale/types.ts";

import { PaymentPanel } from "./PaymentPanel.tsx";
import { buildSubmitOrderInput, useSubmitOrder } from "./use-submit-order.ts";

type Props = {
  draft: Draft;
  catalog: SaleCatalog;
  onBack: () => void;
  onCompleted: () => void;
};

export function PaymentFlow({ draft, catalog, onBack, onCompleted }: Props) {
  const submitOrder = useSubmitOrder(onCompleted);
  return (
    <PaymentPanel
      draft={draft}
      catalog={catalog}
      pending={submitOrder.isPending}
      onBack={onBack}
      onSubmit={async (amountTenderedCentavos) => {
        await submitOrder.mutateAsync(
          buildSubmitOrderInput(draft, catalog, amountTenderedCentavos),
        );
      }}
    />
  );
}
