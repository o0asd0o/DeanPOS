import { useMutation } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import type { Receipt } from "contract/src/contract.ts";

import { clearDraft, type Draft } from "@/features/sale/draft-store.ts";
import type { SaleCatalog, SaleDelta } from "@/features/sale/types.ts";

type Snapshot = {
  id: string;
  name: string;
  deltaKind: "absolute" | "multiplier";
  deltaValue: number;
};

function toSnapshot(id: string, name: string, delta: SaleDelta): Snapshot {
  return delta.kind === "absolute"
    ? { id, name, deltaKind: "absolute", deltaValue: delta.amountCentavos }
    : { id, name, deltaKind: "multiplier", deltaValue: delta.perMille };
}

export function buildSubmitOrderInput(
  draft: Draft,
  catalog: SaleCatalog,
  paymentMethodId: string,
  amountTenderedCentavos: number,
  cashierUserId: string,
) {
  if (!draft.deviceSequence || !draft.orderNumber) {
    throw new Error("The Order number must be assigned before submission.");
  }
  return {
    id: draft.id,
    paymentMethodId,
    cashierUserId,
    deviceSequence: draft.deviceSequence,
    orderNumber: draft.orderNumber,
    lines: draft.lines.map((line) => {
      const item = catalog.menuItems.find((candidate) => candidate.id === line.menuItemId);
      if (!item) throw new Error("The order contains an item that is no longer available.");
      const modifiers = item.modifierGroups.flatMap((group) => group.modifiers);
      return {
        menuItemId: line.menuItemId,
        menuItemName: line.menuItemName,
        variantId: line.variantId,
        variantName: line.variantName,
        unitPriceCentavos: line.unitPriceCentavos,
        quantity: line.quantity,
        lineTotalCentavos: line.totalCentavos,
        discountIds: line.lineDiscountId ? [line.lineDiscountId] : [],
        modifiers: line.modifierIds.map((id) => {
          const modifier = modifiers.find((candidate) => candidate.id === id);
          if (!modifier)
            throw new Error("The order contains a modifier that is no longer available.");
          return toSnapshot(modifier.id, modifier.name, modifier.delta);
        }),
        addOns: line.addOnIds.map((id) => {
          const addOn = item.addOns.find((candidate) => candidate.id === id);
          if (!addOn) throw new Error("The order contains an add-on that is no longer available.");
          return toSnapshot(addOn.id, addOn.name, addOn.delta);
        }),
      };
    }),
    discountId: draft.discountId ?? null,
    totalCentavos: (() => {
      const discount = (catalog.discounts ?? []).find(
        (candidate) =>
          candidate.id === draft.discountId &&
          candidate.scope === "order" &&
          candidate.value !== null,
      );
      if (!discount) return draft.totalCentavos;
      const amount =
        discount.type === "amount"
          ? discount.value!
          : Math.floor((draft.totalCentavos * discount.value! + 5_000) / 10_000);
      return draft.totalCentavos - amount;
    })(),
    amountTenderedCentavos,
  };
}

export function useSubmitOrder(onCompleted: (receipt: Receipt) => void) {
  const { orpc } = useRouteContext({ from: "/" });
  return useMutation(
    orpc.terminal.submitOrder.mutationOptions({
      onSuccess: (result) => {
        if (!result.ok) return;
        clearDraft();
        onCompleted(result.receipt);
      },
      meta: {
        success: "Sale completed",
        successDescription: "The paid order was saved.",
        error: "Couldn't complete the sale",
      },
    }),
  );
}
