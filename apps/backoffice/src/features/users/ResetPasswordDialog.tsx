import { useState } from "react";
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

// The reset (record 043's "reset" section): the same field shape as create,
// in its own procedure and its own `Dialog`, never the editor's save.
export function ResetPasswordDialog({
  user,
  onOpenChange,
  onReset,
}: {
  user: UserOutput;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
}) {
  const [password, setPassword] = useState("");
  const resetPassword = useResetUserPasswordMutation();

  const handleReset = async () => {
    if (resetPassword.isPending) return;
    const result = await resetPassword.mutateAsync({ id: user.id, password });
    if (!result) return;
    // Never lingers in TanStack Query's retained `variables` (record 043
    // no-go 8).
    resetPassword.reset();
    onReset();
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {user.email}?</DialogTitle>
          <DialogDescription>
            This signs them out now, and they choose a new password the next time they sign in
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="new-temporary-password">New temporary password</label>
          <p id="new-temporary-password-hint" className="text-foreground">
            At least 8 characters. Any characters, including spaces — there are no other rules.
          </p>
          <PasswordInput
            id="new-temporary-password"
            autoComplete="new-password"
            required
            minLength={8}
            aria-describedby="new-temporary-password-hint"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
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
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button aria-disabled={resetPassword.isPending} onClick={handleReset}>
            {resetPassword.isPending ? "Resetting…" : "Reset password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
