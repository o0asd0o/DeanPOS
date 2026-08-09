import { useForm } from "@tanstack/react-form";
import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button, Input, cn, useSubmitGate } from "ui";

import { SheetForm } from "@/components/SheetForm.tsx";
import { useCreateDiscountMutation, useUpdateDiscountMutation } from "./__common/queries.ts";
import type { DiscountOutput } from "./helpers.ts";

export function DiscountEditor({
  discount,
  onSaved,
  onCancel,
}: {
  discount: DiscountOutput | null;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const create = useCreateDiscountMutation();
  const update = useUpdateDiscountMutation();
  const saving = create.isPending || update.isPending;
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      name: discount?.name ?? "",
      type: discount?.type ?? "percent",
      value:
        discount?.value === null || discount?.value === undefined
          ? ""
          : String(discount.value / 100),
      scope: discount?.scope ?? "order",
      requiresOverride: discount?.requiresOverride ?? true,
      vatExempt: discount?.vatExempt ?? false,
      requiresReference: discount?.requiresReference ?? false,
      referenceLabel: discount?.referenceLabel ?? "",
    },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      if (name === "") {
        setError("Enter a name for the discount.");
        return;
      }
      const parsed = value.value.trim() === "" ? null : Number(value.value) * 100;
      if (
        parsed !== null &&
        (!Number.isInteger(parsed) || parsed <= 0 || (value.type === "percent" && parsed > 10000))
      ) {
        setError("Enter a valid discount value.");
        return;
      }
      if (value.requiresReference && value.referenceLabel.trim() === "") {
        setError("Add a label for the reference.");
        return;
      }
      const common = {
        name,
        value: parsed,
        requiresOverride: value.requiresOverride,
        vatExempt: value.vatExempt,
        requiresReference: value.requiresReference,
        referenceLabel: value.requiresReference ? value.referenceLabel.trim() : null,
      };
      const payload =
        value.type === "amount"
          ? { ...common, type: "amount" as const, scope: "order" as const }
          : { ...common, type: "percent" as const, scope: value.scope as "order" | "line" };
      const saved = discount
        ? await update.mutateAsync({ id: discount.discountId, ...payload })
        : await create.mutateAsync(payload);
      if (!saved) {
        setError("Couldn’t save the discount. Your draft is still here.");
        return;
      }
      onSaved(discount ? "Discount saved" : "Discount created");
    },
  });
  const gate = useSubmitGate(form, { busy: saving });
  return (
    <SheetForm
      title={discount ? `Edit ${discount.name}` : "New discount"}
      busy={saving}
      onSubmit={gate.submit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            <XIcon />
            Cancel
          </Button>
          <Button type="submit" aria-disabled={gate.blocked}>
            <CheckIcon />
            {discount ? "Save changes" : "Create discount"}
          </Button>
        </>
      }
    >
      {error ? (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm">
          {error}
        </div>
      ) : null}
      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="discount-name">Name</label>
            <Input
              id="discount-name"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Senior citizen / PWD"
            />
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.values.type, state.values.value] as const}>
        {([type, value]) => (
          <fieldset className="flex flex-col gap-2">
            <legend>Type</legend>
            <div className="flex gap-2" role="radiogroup" aria-label="Discount type">
              <button
                type="button"
                role="radio"
                aria-checked={type === "percent"}
                onClick={() => form.setFieldValue("type", "percent")}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                  type === "percent"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card text-foreground hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    type === "percent" ? "border-primary" : "border-muted-foreground",
                  )}
                >
                  {type === "percent" && <span className="size-2 rounded-full bg-primary" />}
                </span>
                Percent
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={type === "amount"}
                onClick={() => {
                  form.setFieldValue("type", "amount");
                  form.setFieldValue("scope", "order");
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                  type === "amount"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card text-foreground hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    type === "amount" ? "border-primary" : "border-muted-foreground",
                  )}
                >
                  {type === "amount" && <span className="size-2 rounded-full bg-primary" />}
                </span>
                Amount
              </button>
            </div>
            <label htmlFor="discount-value">Value</label>
            <div className="relative">
              <Input
                id="discount-value"
                inputMode="decimal"
                value={value}
                onChange={(event) => form.setFieldValue("value", event.target.value)}
                placeholder="Leave blank — prompt the cashier"
              />
              <span
                className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              >
                {type === "percent" ? "%" : "₱"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Leave blank — prompt the cashier.</p>
          </fieldset>
        )}
      </form.Subscribe>
      <form.Subscribe selector={(state) => [state.values.type, state.values.scope] as const}>
        {([type, scope]) => (
          <fieldset className="flex flex-col gap-2">
            <legend>Scope</legend>
            <div className="flex gap-2" role="radiogroup" aria-label="Discount scope">
              <button
                type="button"
                role="radio"
                aria-checked={scope === "order"}
                onClick={() => form.setFieldValue("scope", "order")}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                  scope === "order"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card text-foreground hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    scope === "order" ? "border-primary" : "border-muted-foreground",
                  )}
                >
                  {scope === "order" && <span className="size-2 rounded-full bg-primary" />}
                </span>
                Whole order
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={scope === "line"}
                disabled={type === "amount"}
                onClick={() => form.setFieldValue("scope", "line")}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                  scope === "line"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card text-foreground hover:bg-accent",
                  type === "amount" && "cursor-not-allowed opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    scope === "line" ? "border-primary" : "border-muted-foreground",
                  )}
                >
                  {scope === "line" && <span className="size-2 rounded-full bg-primary" />}
                </span>
                Per line
              </button>
            </div>
            <p className="text-sm text-muted-foreground">Amount discounts are whole-order only.</p>
          </fieldset>
        )}
      </form.Subscribe>
      <form.Subscribe
        selector={(state) =>
          [
            state.values.requiresOverride,
            state.values.vatExempt,
            state.values.requiresReference,
          ] as const
        }
      >
        {([requiresOverride, vatExempt, requiresReference]) => (
          <fieldset className="flex flex-col gap-3">
            <legend>Controls</legend>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={requiresOverride}
                onChange={(event) => form.setFieldValue("requiresOverride", event.target.checked)}
              />
              Requires a manager
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={vatExempt}
                onChange={(event) => form.setFieldValue("vatExempt", event.target.checked)}
              />
              VAT-exempt{" "}
              <span className="text-sm text-muted-foreground">Removes VAT from this sale.</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={requiresReference}
                onChange={(event) => form.setFieldValue("requiresReference", event.target.checked)}
              />
              Requires a reference
            </label>
          </fieldset>
        )}
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.values.requiresReference}>
        {(requiresReference) =>
          requiresReference ? (
            <form.Field name="referenceLabel">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="discount-reference">Reference label</label>
                  <Input
                    id="discount-reference"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="e.g. ID number"
                  />
                </div>
              )}
            </form.Field>
          ) : null
        }
      </form.Subscribe>
    </SheetForm>
  );
}
