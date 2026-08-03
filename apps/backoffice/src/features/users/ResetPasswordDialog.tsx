import { useForm } from "@tanstack/react-form";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PasswordInput,
} from "ui";

import { useResetUserPasswordMutation } from "./__common/queries.ts";
import type { UserOutput } from "./helpers.ts";

// The reset (record 043's "reset" section, record 037): a real form, so
// native constraint validation and Enter-to-submit both work.
export function ResetPasswordDialog({
  user,
  onOpenChange,
  onReset,
}: {
  user: UserOutput;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
}) {
  const resetPassword = useResetUserPasswordMutation();

  const form = useForm({
    defaultValues: { password: "" },
    onSubmit: async ({ value }) => {
      const result = await resetPassword.mutateAsync({ id: user.id, password: value.password });
      if (!result) return;
      // Never lingers in TanStack Query's retained `variables` (record 043
      // no-go 8).
      resetPassword.reset();
      onReset();
    },
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (resetPassword.isPending) return;
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Reset password for {user.email}?</DialogTitle>
            <DialogDescription>
              This signs them out now, and they choose a new password the next time they sign in
            </DialogDescription>
          </DialogHeader>
          <form.Field name="password">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor="new-temporary-password">New temporary password</label>
                <p id="new-temporary-password-hint" className="text-foreground">
                  At least 8 characters. Any characters, including spaces — there are no other
                  rules.
                </p>
                <PasswordInput
                  id="new-temporary-password"
                  name={field.name}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  aria-describedby="new-temporary-password-hint"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          {resetPassword.isError && (
            <div
              role="alert"
              className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
            >
              Couldn&rsquo;t reset the password
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" aria-disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "Resetting…" : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
