import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { CheckIcon, XIcon } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, PasswordInput } from "ui";

import { policyRejectionMessage } from "@/lib/policy-rejection.ts";

// Issue 16, record 065: currentPassword and newPassword are both required —
// a second procedure, `auth.changePassword`, never a branch on setPassword.
// `reason` failures (wrong-current-password, throttled, refused) are
// inline text; a policy-invalid newPassword arrives as a BAD_REQUEST.
export function PasswordCard() {
  const { orpc } = useRouteContext({ from: "/_shell/account" });
  const changePassword = useMutation(
    orpc.auth.changePassword.mutationOptions({
      meta: { success: "Password changed", error: "Couldn't change the password" },
    }),
  );
  const policyMessage = policyRejectionMessage(changePassword.error);

  const form = useForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    onSubmit: async ({ value }) => {
      try {
        const result = await changePassword.mutateAsync({
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
        });
        if (!result.ok) return;
        form.reset();
        changePassword.reset();
      } catch {
        // isError / policyMessage already cover the surfaced message.
      }
    },
  });

  const reasonMessage =
    changePassword.data && !changePassword.data.ok
      ? {
          "wrong-current-password": "Current password is incorrect",
          throttled: "Too many attempts — try again later",
          refused: "Couldn't change the password",
        }[changePassword.data.reason]
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (changePassword.isPending) return;
            void form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <form.Field name="currentPassword">
            {(field) => (
              <div className="flex max-w-xs flex-col gap-2">
                <label htmlFor="current-password">Current password</label>
                <PasswordInput
                  id="current-password"
                  name={field.name}
                  autoComplete="current-password"
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="newPassword">
            {(field) => (
              <div className="flex max-w-xs flex-col gap-2">
                <label htmlFor="new-password">New password</label>
                <p id="new-password-hint" className="text-sm text-foreground">
                  At least 8 characters. Any characters, including spaces — there are no other
                  rules.
                </p>
                <PasswordInput
                  id="new-password"
                  name={field.name}
                  autoComplete="new-password"
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
            validators={{
              onSubmit: ({ value, fieldApi }) =>
                value === fieldApi.form.getFieldValue("newPassword")
                  ? undefined
                  : "The two passwords do not match",
            }}
          >
            {(field) => (
              <div className="flex max-w-xs flex-col gap-2">
                <label htmlFor="confirm-new-password">Confirm new password</label>
                <PasswordInput
                  id="confirm-new-password"
                  name={field.name}
                  autoComplete="new-password"
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
          <form.Subscribe selector={(state) => state.fieldMeta.confirmPassword?.errors[0]}>
            {(mismatch) =>
              (mismatch || policyMessage || reasonMessage) && (
                <div
                  role="alert"
                  className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
                >
                  {mismatch ?? policyMessage ?? reasonMessage}
                </div>
              )
            }
          </form.Subscribe>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset();
                changePassword.reset();
              }}
            >
              <XIcon />
              Cancel
            </Button>
            <Button type="submit" aria-disabled={changePassword.isPending}>
              <CheckIcon />
              {changePassword.isPending ? "Saving…" : "Save password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
