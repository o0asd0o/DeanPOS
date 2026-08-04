import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { CheckIcon, XIcon } from "lucide-react";
import { Button, Input, useSubmitGate } from "ui";

import { SheetForm } from "@/components/SheetForm.tsx";
import { centavosToEditorString, parsePriceInput, type VariantOutput } from "./helpers.ts";

const NAME_MAX = 60;

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
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-muted-foreground">
                ₱
              </span>
              <Input
                id="variant-price"
                name={field.name}
                inputMode="decimal"
                placeholder="120.00"
                required
                aria-invalid={priceError !== null}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  setPriceError(null);
                  field.handleChange(event.target.value);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Pesos and up to two decimal places. Paste with commas is fine.
            </p>
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
    </SheetForm>
  );
}
