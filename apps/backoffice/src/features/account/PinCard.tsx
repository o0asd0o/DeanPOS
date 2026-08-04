import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { CheckIcon, XIcon } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, PasswordInput, useSubmitGate } from "ui";

// `PinDialog`'s form body (issue 10, record 058), unchanged — one field, no
// `currentPin` — moved here from a `UserMenu` dialog (issue 15, record 063
// Amendment 1 §3).
export function PinCard() {
  const { orpc } = useRouteContext({ from: "/_shell/account" });
  const setPin = useMutation(
    orpc.user.setPin.mutationOptions({
      meta: { success: "PIN saved", error: "Couldn't save the PIN" },
    }),
  );

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

  const gate = useSubmitGate(form, { busy: setPin.isPending });

  return (
    <Card>
      <CardHeader>
        <CardTitle>PIN</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            gate.submit();
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
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset();
                setPin.reset();
              }}
            >
              <XIcon />
              Cancel
            </Button>
            <Button type="submit" aria-disabled={gate.blocked}>
              <CheckIcon />
              {setPin.isPending ? "Saving…" : "Save PIN"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
