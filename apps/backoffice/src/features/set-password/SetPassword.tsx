import { type FormEvent, useState } from "react";
import { ORPCError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { Button, Card, CardContent, CardHeader, CardTitle, PasswordInput } from "ui";

import { ErrorState } from "../../components/ErrorState.tsx";

// A rejection on policy (record 032) arrives as oRPC's own input-validation
// error, carrying the zod issue message; anything else is a real transport
// failure and stays ErrorState's job.
function policyRejectionMessage(error: unknown): string | null {
  if (!(error instanceof ORPCError) || error.code !== "BAD_REQUEST") return null;
  const data = error.data as { issues?: { message?: string }[] } | undefined;
  return data?.issues?.[0]?.message ?? null;
}

// States, copy, colours and order are record 030's, extended with the two
// decisions this screen adds: no current-password field, and a confirm field.
export function SetPassword() {
  const { orpc } = useRouteContext({ from: "/_gate/set-password" });
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const setPassword = useMutation(orpc.auth.setPassword.mutationOptions());
  const policyMessage = policyRejectionMessage(setPassword.error);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (setPassword.isPending) return;

    setMismatch(false);
    if (newPassword !== confirmPassword) {
      setMismatch(true);
      return;
    }

    try {
      await setPassword.mutateAsync({ newPassword });
    } catch {
      return; // surfaced below via setPassword.error / policyMessage
    }
    await navigate({ to: "/" });
  };

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
          onSubmit={handleSubmit}
          aria-busy={setPassword.isPending}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="new-password">New password</label>
            <p id="new-password-hint" className="text-sm text-foreground">
              At least 8 characters. Any characters, including spaces — there are no other rules.
            </p>
            <PasswordInput
              id="new-password"
              name="new-password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-describedby="new-password-hint"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="confirm-password">Confirm new password</label>
            <PasswordInput
              id="confirm-password"
              name="confirm-password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-invalid={mismatch}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" aria-disabled={setPassword.isPending}>
            {setPassword.isPending ? "Saving…" : "Save and continue"}
          </Button>
          {(mismatch || policyMessage) && (
            <div
              role="alert"
              className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
            >
              {mismatch ? "The two passwords do not match" : policyMessage}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
