import { useEffect, useRef, useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { Button, Input } from "ui";

import { SheetForm } from "@/components/SheetForm.tsx";

import { AvailabilityField } from "./AvailabilityField.tsx";
import {
  useCreatePaymentMethodMutation,
  useStoresQuery,
  useUpdatePaymentMethodMutation,
} from "./__common/queries.ts";
import { PAYMENT_METHOD_NAME_PRESETS } from "./helpers.ts";
import type { PaymentMethodOutput } from "./helpers.ts";

// The method editor (record 054 Q3): one form, one Save, name and the whole
// availability set move together. No `kind` control — every created method
// is `recorded`, and `cash` never opens this sheet.
export function PaymentMethodEditor({
  method,
  onSaved,
  onCancel,
}: {
  method: PaymentMethodOutput | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const storesQuery = useStoresQuery();
  const stores = (storesQuery.data ?? []).filter((store) => store.active);

  const [storeIds, setStoreIds] = useState<Set<string>>(() => new Set(method?.storeIds ?? []));
  // Stores arrive asynchronously, after this component's first render, so a
  // new method's default (every Store checked) is seeded once they load
  // rather than computed at mount, when the query has no data yet.
  const defaultedRef = useRef(method !== null);
  useEffect(() => {
    if (defaultedRef.current || stores.length === 0) return;
    defaultedRef.current = true;
    setStoreIds(new Set(stores.map((store) => store.id)));
  }, [stores]);

  const createMethod = useCreatePaymentMethodMutation();
  const updateMethod = useUpdatePaymentMethodMutation();
  const saving = createMethod.isPending || updateMethod.isPending;
  const failed = createMethod.isError || updateMethod.isError;

  const form = useForm({
    defaultValues: { name: method?.name ?? "" },
    onSubmit: async ({ value }) => {
      const saved = method
        ? await updateMethod.mutateAsync({
            id: method.id,
            name: value.name,
            storeIds: [...storeIds],
          })
        : await createMethod.mutateAsync({ name: value.name, storeIds: [...storeIds] });
      if (!saved) return;
      onSaved();
    },
  });

  return (
    <SheetForm
      title={method ? `Edit ${method.name}` : "New method"}
      busy={saving}
      onSubmit={() => void form.handleSubmit()}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            <XIcon />
            Cancel
          </Button>
          <Button type="submit" aria-disabled={saving}>
            <CheckIcon />
            {method
              ? saving
                ? "Saving…"
                : "Save changes"
              : saving
                ? "Creating…"
                : "Create method"}
          </Button>
        </>
      }
    >
      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="payment-method-name">Name</label>
            <Input
              id="payment-method-name"
              name={field.name}
              list="payment-method-name-presets"
              placeholder="GCash"
              required
              autoFocus
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <datalist id="payment-method-name-presets">
              {PAYMENT_METHOD_NAME_PRESETS.map((preset) => (
                <option key={preset} value={preset} />
              ))}
            </datalist>
          </div>
        )}
      </form.Field>
      <AvailabilityField stores={stores} selectedIds={storeIds} onChange={setStoreIds} />
      {failed && (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground">
          Couldn&rsquo;t save the payment method
        </div>
      )}
    </SheetForm>
  );
}
