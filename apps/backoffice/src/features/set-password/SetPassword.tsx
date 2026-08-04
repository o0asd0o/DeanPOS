import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { Button, Card, CardContent, CardHeader, CardTitle, PasswordInput } from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";
import { policyRejectionMessage } from "@/lib/policy-rejection.ts";

// States, copy, colours and order are record 030's, extended with the two
// decisions this screen adds: no current-password field, and a confirm field.
export function SetPassword() {
  const { orpc } = useRouteContext({ from: "/_gate/set-password" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const setPassword = useMutation(
    orpc.auth.setPassword.mutationOptions({
      meta: { success: "Password changed", error: "Couldn't change the password" },
    }),
  );
  const policyMessage = policyRejectionMessage(setPassword.error);

  const form = useForm({
    defaultValues: { newPassword: "", confirmPassword: "" },
    onSubmit: async ({ value }) => {
      try {
        await setPassword.mutateAsync({ newPassword: value.newPassword });
      } catch {
        return; // surfaced below via setPassword.error / policyMessage
      }
      // The cached `auth.me` still carries the must-change flag this call
      // just cleared, and `_shell`'s guard would bounce back to this screen.
      await queryClient.invalidateQueries({ queryKey: orpc.auth.me.queryKey() });
      await navigate({ to: "/" });
    },
  });

  if (setPassword.isError && !policyMessage) {
    return <ErrorState onRetry={() => setPassword.reset()} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          Set a new password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Your password was set by an administrator. Choose a new one to continue.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            // No pristine gate: this screen takes sign-in's treatment, and
            // record 030 forbids disabling the commit for validation.
            if (setPassword.isPending) return;
            void form.handleSubmit();
          }}
          aria-busy={setPassword.isPending}
          className="flex flex-col gap-4"
        >
          <form.Field name="newPassword">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor="new-password">New password</label>
                <p id="new-password-hint" className="text-sm text-foreground">
                  At least 8 characters. Any characters, including spaces — there are no other
                  rules.
                </p>
                <PasswordInput
                  id="new-password"
                  name={field.name}
                  autoComplete="new-password"
                  placeholder="Your new password"
                  required
                  minLength={8}
                  aria-describedby="new-password-hint"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field
            name="confirmPassword"
            // Record 030 marks only the confirm field, so the check belongs to
            // it rather than to the form.
            validators={{
              onSubmit: ({ value, fieldApi }) =>
                value === fieldApi.form.getFieldValue("newPassword")
                  ? undefined
                  : "The two passwords do not match",
            }}
          >
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor="confirm-password">Confirm new password</label>
                <PasswordInput
                  id="confirm-password"
                  name={field.name}
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  required
                  minLength={8}
                  aria-invalid={field.state.meta.errors.length > 0}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          <Button type="submit" className="w-full" aria-disabled={setPassword.isPending}>
            {setPassword.isPending ? "Saving…" : "Save and continue"}
          </Button>
          <form.Subscribe selector={(state) => state.fieldMeta.confirmPassword?.errors[0]}>
            {(mismatch) =>
              (mismatch || policyMessage) && (
                <div
                  role="alert"
                  className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
                >
                  {mismatch ?? policyMessage}
                </div>
              )
            }
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
