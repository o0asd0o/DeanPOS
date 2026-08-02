import { type FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "ui";

import { ErrorState } from "../../components/ErrorState.tsx";

// States, copy, colours and order are record 030's, not a matter of taste
// here — see .scratch/decisions/030-the-back-office-sign-in-screen.md.
export function SignIn() {
  const { orpc } = useRouteContext({ from: "/_gate/login" });
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);

  const signIn = useMutation(orpc.auth.signIn.mutationOptions());

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The early return, not `aria-disabled`, is what stops a double POST —
    // record 030.
    if (signIn.isPending) return;

    setFailed(false);
    const result = await signIn.mutateAsync({ email, password });

    if (!result.ok) {
      setFailed(true);
      return;
    }

    await navigate({ to: result.mustChangePassword ? "/set-password" : "/" });
  };

  if (signIn.isError) {
    return <ErrorState onRetry={() => signIn.reset()} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          DeanPOS back-office
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} aria-busy={signIn.isPending} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email">Email</label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="password">Password</label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" aria-disabled={signIn.isPending}>
            {signIn.isPending ? "Signing in…" : "Sign in"}
          </Button>
          {failed && (
            <div
              role="alert"
              className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
            >
              Email or password is incorrect
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
