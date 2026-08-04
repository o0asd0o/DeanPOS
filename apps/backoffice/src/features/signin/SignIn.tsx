import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PasswordInput } from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";

// States, copy, colours and order are record 030's, not a matter of taste
// here — see .scratch/decisions/030-the-back-office-sign-in-screen.md.
export function SignIn() {
  const { orpc } = useRouteContext({ from: "/_gate/login" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Not a field error: record 030 requires one form-level sentence naming
  // neither field, so it is the submit's outcome and not the form's state.
  const [failed, setFailed] = useState(false);

  // `{ ok: false }` is a refusal, so the toast layer reads it as a failure —
  // the sentence below stays the precise one.
  const signIn = useMutation(
    orpc.auth.signIn.mutationOptions({
      meta: { success: "Signed in", error: "Couldn't sign in" },
    }),
  );

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      setFailed(false);
      const result = await signIn.mutateAsync(value);

      if (!result.ok) {
        setFailed(true);
        return;
      }

      // The guard that runs next reads `auth.me` from cache, and the answer
      // sitting there is the signed-out one it cached before this sign-in —
      // without this it redirects straight back to `/login`.
      await queryClient.invalidateQueries({ queryKey: orpc.auth.me.queryKey() });
      await navigate({ to: result.mustChangePassword ? "/set-password" : "/" });
    },
  });

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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            // The early return, not `aria-disabled`, is what stops a double
            // POST — record 030.
            if (signIn.isPending) return;
            void form.handleSubmit();
          }}
          aria-busy={signIn.isPending}
          className="flex flex-col gap-4"
        >
          <form.Field name="email">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor="email">Email</label>
                <Input
                  id="email"
                  name={field.name}
                  type="email"
                  autoComplete="username"
                  placeholder="name@example.com"
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor="password">Password</label>
                <PasswordInput
                  id="password"
                  name={field.name}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
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
