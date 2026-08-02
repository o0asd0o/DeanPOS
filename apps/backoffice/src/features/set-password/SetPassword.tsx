import { type FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "ui";

import { ErrorState } from "../../components/ErrorState.tsx";

// States, copy, colours and order are record 030's, extended with the two
// decisions this screen adds: no current-password field, and a confirm field.
export function SetPassword() {
  const { orpc } = useRouteContext({ from: "/_gate/set-password" });
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatch, setMismatch] = useState(false);

  const setPassword = useMutation(orpc.auth.setPassword.mutationOptions());

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (setPassword.isPending) return;

    setMismatch(false);
    if (newPassword !== confirmPassword) {
      setMismatch(true);
      return;
    }

    await setPassword.mutateAsync({ newPassword });
    await navigate({ to: "/" });
  };

  if (setPassword.isError) {
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
              At least 15 characters. Any characters, including spaces — there are no other rules.
            </p>
            <Input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={15}
              aria-describedby="new-password-hint"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="confirm-password">Confirm new password</label>
            <Input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={15}
              aria-invalid={mismatch}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" aria-disabled={setPassword.isPending}>
            {setPassword.isPending ? "Saving…" : "Save and continue"}
          </Button>
          {mismatch && (
            <div
              role="alert"
              className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
            >
              The two passwords do not match
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
