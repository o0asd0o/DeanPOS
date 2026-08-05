import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { CheckIcon, XIcon } from "lucide-react";
import { Badge, Button, Input, useSubmitGate } from "ui";

import { MoneyInput } from "@/components/MoneyInput.tsx";
import { SheetForm } from "@/components/SheetForm.tsx";
import {
  centavosToEditorString,
  parsePriceInput,
  type VariantOutput,
} from "@/features/catalog/helpers.ts";
import {
  useAllModifierGroupsQuery,
  useLinkModifierGroupMutation,
  useLinkedModifierGroupsQuery,
  useUnlinkModifierGroupMutation,
} from "./__common/queries.ts";

const NAME_MAX = 60;

// Picker section shown only for existing Variants (not on create).
// Prohibition 8: NO creation control for ModifierGroups here.
function ModifierGroupPicker({ variantId }: { variantId: string }) {
  const allGroupsQuery = useAllModifierGroupsQuery();
  const linkedQuery = useLinkedModifierGroupsQuery(variantId);
  const link = useLinkModifierGroupMutation(variantId);
  const unlink = useUnlinkModifierGroupMutation(variantId);

  const available = (allGroupsQuery.data ?? []).filter((g) => !g.archivedAt);
  const linkedIds = new Set((linkedQuery.data ?? []).map((g) => g.id));

  if (available.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Modifier groups</p>
      <ul className="flex flex-col gap-1" aria-label="Modifier groups">
        {available.map((group) => {
          const linked = linkedIds.has(group.id);
          const busy = link.isPending || unlink.isPending;
          return (
            <li
              key={group.id}
              className="flex items-center justify-between gap-2 rounded-md border p-2"
            >
              <span className="text-sm">{group.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {group.selectionRule}
                </Badge>
                <Button
                  type="button"
                  variant={linked ? "outline" : "ghost"}
                  size="sm"
                  disabled={busy}
                  aria-pressed={linked}
                  aria-label={linked ? `Unlink ${group.name}` : `Link ${group.name}`}
                  onClick={() => {
                    if (linked) {
                      unlink.mutate({ variantId, modifierGroupId: group.id });
                    } else {
                      link.mutate({ variantId, modifierGroupId: group.id });
                    }
                  }}
                >
                  {linked ? "Linked" : "Link"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function VariantEditorSheet({
  variant,
  busy,
  failed,
  onSave,
  onCancel,
}: {
  variant: VariantOutput | null;
  busy: boolean;
  failed: boolean;
  onSave: (value: { name: string; priceCentavos: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [priceError, setPriceError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      name: variant?.name ?? "",
      price: variant ? centavosToEditorString(variant.priceCentavos) : "",
    },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      if (name.length < 1 || name.length > NAME_MAX) return;
      const parsed = parsePriceInput(value.price);
      if (!parsed.ok) {
        setPriceError("Enter pesos and centavos, like 120.00");
        return;
      }
      if (parsed.value < 0) {
        setPriceError("Price cannot be negative");
        return;
      }
      setPriceError(null);
      await onSave({ name, priceCentavos: parsed.value });
    },
  });
  const gate = useSubmitGate(form, { busy });

  return (
    <SheetForm
      title={variant ? `Edit ${variant.name}` : "New variant"}
      busy={busy}
      onSubmit={gate.submit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            <XIcon />
            Cancel
          </Button>
          <Button type="submit" aria-disabled={gate.blocked}>
            <CheckIcon />
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="variant-name">Name</label>
            <Input
              id="variant-name"
              name={field.name}
              placeholder="Regular"
              required
              autoFocus
              maxLength={NAME_MAX}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </div>
        )}
      </form.Field>
      <form.Field name="price">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="variant-price">Price</label>
            <MoneyInput
              id="variant-price"
              name={field.name}
              required
              aria-invalid={priceError !== null}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(v) => {
                setPriceError(null);
                field.handleChange(v);
              }}
            />
          </div>
        )}
      </form.Field>
      {priceError && (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground">
          {priceError}
        </div>
      )}
      {failed && !priceError && (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground">
          Couldn&rsquo;t save the variant
        </div>
      )}
      {variant && <ModifierGroupPicker variantId={variant.id} />}
    </SheetForm>
  );
}
