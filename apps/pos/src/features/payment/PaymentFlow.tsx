import { useRef, useState } from "react";
import type { Receipt } from "contract/src/contract.ts";

import type { Draft } from "@/features/sale/draft-store.ts";
import type { SaleCatalog } from "@/features/sale/types.ts";
import { readDeviceIdentity } from "@/lib/device-token.ts";
import { ORDER_SEQUENCE_EXHAUSTED_MESSAGE } from "@/lib/order-number-sequence.ts";

import { PaymentPanel } from "./PaymentPanel.tsx";
import { submitNumberedDraft } from "./submit-numbered-draft.ts";
import { buildSubmitOrderInput, useSubmitOrder } from "./use-submit-order.ts";

type Props = {
  draft: Draft;
  catalog: SaleCatalog;
  onBack: () => void;
  onDraftChanged: (draft: Draft) => void;
  onCompleted: (receipt: Receipt) => void;
};

export function PaymentFlow({ draft, catalog, onBack, onDraftChanged, onCompleted }: Props) {
  const submissionDraft = useRef(draft);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  if (submissionDraft.current.id !== draft.id) submissionDraft.current = draft;
  const submitOrder = useSubmitOrder(onCompleted);
  return (
    <PaymentPanel
      draft={draft}
      catalog={catalog}
      pending={submitOrder.isPending}
      error={preparationError}
      onBack={onBack}
      onSubmit={async (amountTenderedCentavos) => {
        const identity = readDeviceIdentity();
        if (!identity) throw new Error("This Device must be enrolled before taking payment.");
        setPreparationError(null);
        try {
          await submitNumberedDraft({
            draft: submissionDraft.current,
            identity,
            onPrepared: (numberedDraft) => {
              submissionDraft.current = numberedDraft;
              onDraftChanged(numberedDraft);
            },
            transport: (numberedDraft) =>
              submitOrder.mutateAsync(
                buildSubmitOrderInput(numberedDraft, catalog, amountTenderedCentavos),
              ),
          });
        } catch (error) {
          if (error instanceof Error && error.message === ORDER_SEQUENCE_EXHAUSTED_MESSAGE) {
            setPreparationError(error.message);
          }
        }
      }}
    />
  );
}
