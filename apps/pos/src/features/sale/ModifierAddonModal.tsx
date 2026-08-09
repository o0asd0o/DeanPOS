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
  defaultModifierIds,
  hasRequiredModifiers,
  type DraftLineInput,
} from "./draft-store.ts";
import type { SaleAddOn, SaleMenuItem, SaleModifierGroup, SaleVariant } from "./types.ts";

type Props = {
  item: SaleMenuItem;
  variant: SaleVariant;
  open: boolean;
  initial?: DraftLineInput;
  onOpenChange: (open: boolean) => void;
  onSubmit: (line: DraftLineInput) => void;
};

export function ModifierAddonModal({
  item,
  variant,
  open,
  initial,
  onOpenChange,
  onSubmit,
}: Props) {
  const [modifierIds, setModifierIds] = useState(
    () => initial?.modifierIds ?? defaultModifierIds(item.modifierGroups),
  );
  const [addOnIds, setAddOnIds] = useState(() => initial?.addOnIds ?? []);
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
      variantId: variant.id,
      variantName: variant.name,
      unitPriceCentavos: variant.priceCentavos,
      quantity: initial?.quantity ?? 1,
      modifierIds,
      addOnIds,
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit" : "Customize"} {item.name} · {variant.name}
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
              <div className="grid gap-2 sm:grid-cols-2">
                {group.modifiers.map((modifier) => (
                  <Button
                    key={modifier.id}
                    type="button"
                    variant="outline"
                    aria-pressed={modifierIds.includes(modifier.id)}
                    onClick={() => toggleModifier(group, modifier.id)}
                  >
                    {modifier.name}
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
                    <span>{addOn.name}</span>
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
          {error && (
            <p role="alert" className="text-sm text-status-danger-tone">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit}>
            {initial ? "Save line" : "Add to order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
