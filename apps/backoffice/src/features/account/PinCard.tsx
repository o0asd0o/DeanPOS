import { useForm } from "@tanstack/react-form";
import { CheckIcon } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, PasswordInput } from "ui";

import { useSetPinMutation } from "./__common/queries.ts";

// `PinDialog`'s form body (issue 10, record 058), unchanged — one field, no
// `currentPin` — moved here from a `UserMenu` dialog (issue 15, record 063
// Amendment 1 §3).
export function PinCard() {
  const setPin = useSetPinMutation();

  const form = useForm({
    defaultValues: { pin: "" },
    onSubmit: async ({ value }) => {
      try {
        const result = await setPin.mutateAsync({ pin: value.pin });
        if (!result.ok) return;
        form.reset();
        setPin.reset();
      } catch {
        // isError is already set on the mutation; swallow so it doesn't
        // also surface as an unhandled promise rejection.
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>PIN</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (setPin.isPending) return;
            void form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <p className="text-sm text-muted-foreground">
            You use this PIN to unlock a till. It is four to six digits, and nobody else is shown
            it.
          </p>
          <form.Field name="pin">
            {(field) => (
              <div className="flex max-w-xs flex-col gap-2">
                <label htmlFor="pin">PIN</label>
                <PasswordInput
                  id="pin"
                  name={field.name}
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  minLength={4}
                  pattern="\d{4,6}"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          {setPin.isError && (
            <div
              role="alert"
              className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
            >
              Couldn&rsquo;t save the PIN
            </div>
          )}
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button type="submit" aria-disabled={setPin.isPending}>
              <CheckIcon />
              {setPin.isPending ? "Saving…" : "Save PIN"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
