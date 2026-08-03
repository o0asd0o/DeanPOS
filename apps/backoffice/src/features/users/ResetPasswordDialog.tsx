import { useForm } from "@tanstack/react-form";

import { TemporaryPasswordField } from "./TemporaryPasswordField.tsx";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
      try {
        const result = await resetPassword.mutateAsync({ id: user.id, password: value.password });
        if (!result) return;
        resetPassword.evictPassword();
        onReset();
      } catch {
        // isError is already set on the mutation; swallow so it doesn't
        // also surface as an unhandled promise rejection.
      }
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
          className="flex flex-col gap-6"
        >
          <DialogHeader>
            <DialogTitle>Reset password for {user.email}?</DialogTitle>
            <DialogDescription>
              This signs them out now, and they choose a new password the next time they sign in
            </DialogDescription>
          </DialogHeader>
          <form.Field name="password">
            {(field) => (
              <TemporaryPasswordField
                id="new-temporary-password"
                name={field.name}
                label="New temporary password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(next) => field.handleChange(next)}
              />
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
          <DialogFooter className="mt-2 border-t pt-4">
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
