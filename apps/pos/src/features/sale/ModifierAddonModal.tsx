import { useState, type MouseEvent } from "react";
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
import { formatPeso } from "@/features/helpers.ts";
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
  onSubmit: (line: DraftLineInput, source: HTMLButtonElement) => void;
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
  const basePrice = variant?.priceCentavos ?? item.priceCentavos;
  const [modifierIds, setModifierIds] = useState(
    () => initial?.modifierIds ?? defaultModifierIds(item.modifierGroups),
  );
  const [addOnIds, setAddOnIds] = useState(() => initial?.addOnIds ?? []);
  const [quantity, setQuantity] = useState(() => initial?.quantity ?? 1);
  const [error, setError] = useState("");
  const line: DraftLineInput = {
    menuItemId: item.id,
    menuItemName: item.name,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? "",
    unitPriceCentavos: basePrice,
    quantity,
    modifierIds,
    addOnIds,
  };
  const runningTotal = composeLine(
    line,
    item.modifierGroups.flatMap((group) => group.modifiers),
    item.addOns,
  ).totalCentavos;

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
  const submit = (event: MouseEvent<HTMLButtonElement>) => {
    if (!hasRequiredModifiers(item.modifierGroups, modifierIds)) {
      setError("Choose an option in every required group.");
      return;
    }
    setError("");
    onSubmit(line, event.currentTarget);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-screen flex-col overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit " : ""}
            {item.name}
            {variant ? ` · ${variant.name}` : ""} {formatPeso(basePrice)}
          </DialogTitle>
          <DialogDescription>
            {initial ? "Edit this line." : "Choose options for this line."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {item.modifierGroups.map((group) => (
            <fieldset key={group.id} className="flex flex-col gap-2">
              <legend className="pb-2 text-sm font-semibold text-muted-foreground">
                {group.name}
                {group.selectionRule === "required-one" ? " · required" : ""}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.modifiers.map((modifier) => (
                  <Button
                    key={modifier.id}
                    type="button"
                    variant="outline"
                    className="h-12 justify-between rounded-xl"
                    aria-pressed={modifierIds.includes(modifier.id)}
                    onClick={() => toggleModifier(group, modifier.id)}
                  >
                    <span className="truncate">{modifier.name}</span>
                    <span className="text-xs">{formatDelta(modifier.delta, basePrice)}</span>
                  </Button>
                ))}
              </div>
            </fieldset>
          ))}

          {item.addOns.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="pb-2 text-sm font-semibold text-muted-foreground">Add-ons</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {item.addOns.map((addOn) => {
                  const count = addOnIds.filter((id) => id === addOn.id).length;
                  return (
                    <div
                      key={addOn.id}
                      className="flex h-14 items-center justify-between gap-3 rounded-xl bg-muted/60 px-3"
                    >
                      <span className="min-w-0 truncate">{addOn.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDelta(addOn.delta, basePrice)}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-lg"
                          className="text-xl"
                          aria-label={`Remove one ${addOn.name}`}
                          disabled={count === 0}
                          onClick={() => changeAddOn(addOn, count - 1)}
                        >
                          −
                        </Button>
                        <span aria-label={`${addOn.name} quantity`} className="w-4 text-center">
                          {count}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-lg"
                          className="text-xl"
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
              </div>
            </fieldset>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="pb-2 text-sm font-semibold text-muted-foreground">Quantity</legend>
            <div className="flex items-center gap-6">
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="text-2xl"
                aria-label={`Decrease ${item.name} quantity`}
                disabled={quantity === 1}
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              >
                −
              </Button>
              <span
                aria-label={`${item.name} quantity`}
                className="w-8 text-center text-xl font-semibold"
              >
                {quantity}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="text-2xl"
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
            <Button type="button" variant="ghost" danger className="mr-auto" onClick={onRemove}>
              Remove
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" size="lg" onClick={submit}>
            {initial ? "Save" : "Add to order"} {formatPeso(runningTotal)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
