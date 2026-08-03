import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "ui";

import { SheetForm } from "@/components/SheetForm.tsx";
import { useGenerateCodeMutation } from "./__common/queries.ts";

type GeneratedResult = {
  secret: string;
  name: string;
  code: string;
  storeId: string;
  expiresAt: Date;
};

// The enrolment-code panel (record 056 Q5): a detached sheet, not an inline
// card — on success the sheet's own body is replaced by the result, never a
// separate screen. Expiry is computed once at render, never ticking.
export function GenerateCodeSheet({
  stores,
  onClose,
  onAnnounce,
}: {
  stores: { id: string; name: string }[];
  onClose: () => void;
  onAnnounce: (message: string) => void;
}) {
  const generateCode = useGenerateCodeMutation();
  const [result, setResult] = useState<GeneratedResult | null>(null);

  const form = useForm({
    defaultValues: { storeId: stores[0]?.id ?? "", name: "", code: "" },
    onSubmit: async ({ value }) => {
      const generated = await generateCode.mutateAsync({
        storeId: value.storeId,
        name: value.name,
        code: value.code.trim().toUpperCase(),
      });
      if (!generated.ok) return;
      setResult({
        secret: generated.secret,
        name: generated.name,
        code: generated.code,
        storeId: generated.storeId,
        expiresAt: generated.expiresAt,
      });
      onAnnounce("Code generated");
    },
  });

  if (result) {
    const storeName = stores.find((store) => store.id === result.storeId)?.name ?? "";
    const grouped = `${result.secret.slice(0, 4)} — ${result.secret.slice(4)}`;
    return (
      <SheetForm
        title="Enrolment code"
        onSubmit={() => {}}
        footer={
          <Button type="button" onClick={onClose} className="ml-auto">
            Done
          </Button>
        }
      >
        <p className="text-2xl font-semibold tracking-widest">{grouped}</p>
        <p className="text-foreground">
          {result.name} · {storeName}
        </p>
        <p className="text-muted-foreground">Single-use. Enter it on the terminal.</p>
        <p className="text-muted-foreground">
          Expires in 10 minutes, at{" "}
          <time dateTime={result.expiresAt.toISOString()}>
            {result.expiresAt.toLocaleTimeString()}
          </time>
          .
        </p>
      </SheetForm>
    );
  }

  const saving = generateCode.isPending;
  const failed = generateCode.isError || (generateCode.data && !generateCode.data.ok);

  return (
    <SheetForm
      title="Enrol a device"
      busy={saving}
      onSubmit={() => void form.handleSubmit()}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" aria-disabled={saving}>
            {saving ? "Generating…" : "Generate code"}
          </Button>
        </>
      }
    >
      <form.Field name="storeId">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="device-store">Store</label>
            <Select value={field.state.value} onValueChange={field.handleChange}>
              <SelectTrigger id="device-store" autoFocus>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>
      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="device-name">Name</label>
            <Input
              id="device-name"
              name={field.name}
              placeholder="Counter 2"
              required
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </div>
        )}
      </form.Field>
      <form.Field name="code">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="device-code">Short code</label>
            <Input
              id="device-code"
              name={field.name}
              placeholder="C2"
              required
              autoCapitalize="characters"
              spellCheck={false}
              aria-describedby="device-code-hint"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <p id="device-code-hint" className="text-xs text-muted-foreground">
              2-4 characters, letters and digits. Prints on every receipt from this Device.
            </p>
          </div>
        )}
      </form.Field>
      {failed && (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground">
          Couldn&rsquo;t generate a code — it may already be in use at that Store
        </div>
      )}
    </SheetForm>
  );
}
