import { CheckIcon, XIcon } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useSubmitGate,
} from "ui";

import { SheetForm } from "@/components/SheetForm.tsx";
import { useGenerateCodeMutation } from "./__common/queries.ts";
import type { EnrolmentCode } from "./helpers.ts";

// The enrolment form (record 056 Q5): a detached sheet, not an inline card.
// On success the sheet hands the code to the dialog and closes.
export function GenerateCodeSheet({
  stores,
  onClose,
  onGenerated,
  onAnnounce,
}: {
  stores: { id: string; name: string }[];
  onClose: () => void;
  onGenerated: (result: EnrolmentCode) => void;
  onAnnounce: (message: string) => void;
}) {
  const generateCode = useGenerateCodeMutation();

  const form = useForm({
    defaultValues: { storeId: stores[0]?.id ?? "", name: "", code: "" },
    onSubmit: async ({ value }) => {
      const generated = await generateCode.mutateAsync({
        storeId: value.storeId,
        name: value.name,
        code: value.code.trim().toUpperCase(),
      });
      if (!generated.ok) return;
      onGenerated({
        secret: generated.secret,
        name: generated.name,
        code: generated.code,
        storeId: generated.storeId,
        expiresAt: generated.expiresAt,
      });
      onAnnounce("Code generated");
    },
  });

  const saving = generateCode.isPending;
  const failed = generateCode.isError || (generateCode.data && !generateCode.data.ok);
  const gate = useSubmitGate(form, { busy: saving });

  return (
    <SheetForm
      title="Enrol a device"
      busy={saving}
      onSubmit={gate.submit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            <XIcon />
            Cancel
          </Button>
          <Button type="submit" aria-disabled={gate.blocked}>
            <CheckIcon />
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
