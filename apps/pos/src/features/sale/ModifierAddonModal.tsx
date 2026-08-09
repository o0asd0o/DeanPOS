import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui";

import {
  canAddOn,
  composeLine,
  defaultModifierIds,
  hasRequiredModifiers,
  type DraftLineInput,
} from "./draft-store.ts";
import { formatPeso } from "./helpers.ts";
import type {
  SaleAddOn,
  SaleDelta,
  SaleMenuItem,
  SaleModifierGroup,
  SaleVariant,
} from "./types.ts";

type Props = {
  item: SaleMenuItem;
  variant: SaleVariant | null;
  open: boolean;
  initial?: DraftLineInput;
  onOpenChange: (open: boolean) => void;
  onSubmit: (line: DraftLineInput) => void;
  onRemove: () => void;
};

const deltaCentavos = (delta: SaleDelta, baseCentavos: number) =>
  delta.kind === "absolute"
    ? delta.amountCentavos
    : (baseCentavos * delta.perMille) / 1_000 - baseCentavos;

const formatDelta = (delta: SaleDelta, baseCentavos: number) => {
  const amountCentavos = deltaCentavos(delta, baseCentavos);
  if (amountCentavos === 0) return "—";
  return `${amountCentavos > 0 ? "+" : "−"}${formatPeso(Math.abs(amountCentavos))}`;
};

export function ModifierAddonModal({
  item,
  variant,
  open,
  initial,
  onOpenChange,
  onSubmit,
  onRemove,
}: Props) {
  const [modifierIds, setModifierIds] = useState(
    () => initial?.modifierIds ?? defaultModifierIds(item.modifierGroups),
  );
  const [addOnIds, setAddOnIds] = useState(() => initial?.addOnIds ?? []);
  const [quantity, setQuantity] = useState(() => initial?.quantity ?? 1);
  const [error, setError] = useState("");
  const toggleModifier = (group: SaleModifierGroup, id: string) => {
    setModifierIds((current) => {
      const withoutGroup = current.filter(
        (currentId) => !group.modifiers.some((m) => m.id === currentId),
      );
      if (group.selectionRule === "many") {
        if (current.includes(id)) return current.filter((value) => value !== id);
        if (
          group.maximum !== null &&
          current.filter((value) => group.modifiers.some((m) => m.id === value)).length >=
            group.maximum
        )
          return current;
        return [...current, id];
      }
      return [...withoutGroup, id];
    });
  };
  const changeAddOn = (addOn: SaleAddOn, amount: number) => {
    setAddOnIds((current) => {
      const count = current.filter((id) => id === addOn.id).length;
      if (amount > count && !canAddOn(addOn, current)) return current;
      if (amount < count) {
        const index = current.lastIndexOf(addOn.id);
        return current.filter((_, i) => i !== index);
      }
      return [...current, addOn.id];
    });
  };
  const submit = () => {
    if (!hasRequiredModifiers(item.modifierGroups, modifierIds)) {
      setError("Choose an option in every required group.");
      return;
    }
    setError("");
    onSubmit({
      menuItemId: item.id,
      menuItemName: item.name,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? "",
      unitPriceCentavos: variant?.priceCentavos ?? item.priceCentavos,
      quantity,
      modifierIds,
      addOnIds,
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit" : "Customize"} {item.name}
            {variant ? ` · ${variant.name}` : ""}
          </DialogTitle>
          <DialogDescription>Choose modifiers and add-ons for this line.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {item.modifierGroups.map((group) => (
            <fieldset key={group.id} className="flex flex-col gap-2">
              <legend className="font-semibold">
                {group.name}
                {group.selectionRule === "required-one" ? " (required)" : ""}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.modifiers.map((modifier) => (
                  <Button
                    key={modifier.id}
                    type="button"
                    variant="outline"
                    aria-pressed={modifierIds.includes(modifier.id)}
                    onClick={() => toggleModifier(group, modifier.id)}
                  >
                    {modifier.name}{" "}
                    {formatDelta(modifier.delta, variant?.priceCentavos ?? item.priceCentavos)}
                  </Button>
                ))}
              </div>
            </fieldset>
          ))}
          {item.addOns.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="font-semibold">Add-ons</legend>
              {item.addOns.map((addOn) => {
                const count = addOnIds.filter((id) => id === addOn.id).length;
                return (
                  <div key={addOn.id} className="flex items-center justify-between gap-3">
                    <span>
                      {addOn.name}{" "}
                      {formatDelta(addOn.delta, variant?.priceCentavos ?? item.priceCentavos)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Remove one ${addOn.name}`}
                        disabled={count === 0}
                        onClick={() => changeAddOn(addOn, count - 1)}
                      >
                        −
                      </Button>
                      <span aria-label={`${addOn.name} quantity`}>{count}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Add one ${addOn.name}`}
                        disabled={!canAddOn(addOn, addOnIds)}
                        onClick={() => changeAddOn(addOn, count + 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                );
              })}
            </fieldset>
          )}
          <fieldset className="flex items-center justify-between gap-3">
            <legend className="font-semibold">Quantity</legend>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Decrease ${item.name} quantity`}
                disabled={quantity === 1}
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              >
                −
              </Button>
              <span aria-label={`${item.name} quantity`}>{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Increase ${item.name} quantity`}
                onClick={() => setQuantity((current) => current + 1)}
              >
                +
              </Button>
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-status-danger-tone">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          {initial && (
            <Button type="button" variant="outline" danger onClick={onRemove}>
              Remove
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit}>
            {initial ? "Save" : "Add to order"}{" "}
            {formatPeso(
              composeLine(
                {
                  menuItemId: item.id,
                  menuItemName: item.name,
                  variantId: variant?.id ?? null,
                  variantName: variant?.name ?? "",
                  unitPriceCentavos: variant?.priceCentavos ?? item.priceCentavos,
                  quantity,
                  modifierIds,
                  addOnIds,
                },
                item.modifierGroups.flatMap((group) => group.modifiers),
                item.addOns,
              ).totalCentavos,
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
