import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "ui";

import { readDeviceToken } from "@/lib/device-token.ts";
import { useEnrolMutation, useTerminalMeQuery } from "./__common/queries.ts";

// Stripped of whitespace/dashes, upper-cased, and I/L→1, O→0 per Crockford's
// own decoding rule (record 056 Q5) — never a distinguishable error for a
// mistyped confusable.
const normalizeCode = (raw: string): string =>
  raw.toUpperCase().replace(/[\s-]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");

// The POS enrolment screen (issue 09, record 056 Q5): the existing
// AppShell, one Card, exactly one input. Criterion 1 gives the admin the
// name and short code — the mock's "Name this terminal" field is not built.
export function Enrolment() {
  const navigate = useNavigate();
  const meQuery = useTerminalMeQuery();
  const enrol = useEnrolMutation();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ name: string; storeName: string } | null>(null);
  // Captured once: a fresh enrol overwrites this same key, and that success
  // is handled by `result` below — this only ever gates the initial load.
  const [hadStoredToken] = useState(() => readDeviceToken() !== null);

  useEffect(() => {
    if (meQuery.data?.authenticated) void navigate({ to: "/" });
  }, [meQuery.data, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (enrol.isPending) return;
    const outcome = await enrol.mutateAsync({ secret: normalizeCode(code) });
    if (!outcome.ok) return;
    setResult({ name: outcome.name, storeName: outcome.storeName });
  };

  if (result) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>This terminal is enrolled</CardTitle>
            <CardDescription>
              {result.name} · {result.storeName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => void navigate({ to: "/" })}>
              Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // A stored token that no longer authenticates was revoked. The notice sits
  // above the form rather than replacing it: replacing it strands the terminal,
  // since nothing but a successful enrol clears the token (record 056 Q3).
  if (hadStoredToken && (!meQuery.data || meQuery.data.authenticated)) return null;
  const revoked = hadStoredToken;

  const failed = enrol.isError || (enrol.data && !enrol.data.ok);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Enrol this terminal</CardTitle>
          <CardDescription>
            The store and the terminal&rsquo;s name come from the code — they are not chosen here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {revoked && (
              <p role="alert" className="rounded-md bg-status-warning-tint p-3 text-sm">
                This terminal has been revoked. An admin must enrol it again.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <label htmlFor="enrolment-code">Enrolment code</label>
              <Input
                id="enrolment-code"
                required
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby="enrolment-code-hint"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <p id="enrolment-code-hint" className="text-xs text-muted-foreground">
                Eight characters. Dashes and spaces are ignored.
              </p>
            </div>
            {failed && (
              <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm">
                That code is expired, already used, or not recognised
              </div>
            )}
            <Button type="submit" className="w-full" aria-disabled={enrol.isPending}>
              {enrol.isPending ? "Enrolling…" : "Enrol this terminal"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
