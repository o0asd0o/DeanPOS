import { Card, CardContent, CardHeader, CardTitle } from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";

import { useMeQuery } from "./__common/queries.ts";

// Read-only, and only ever the signed-in User's own row — sourced from
// `auth.me`, never `user.list` (issue 15, record 063 §3): a cashier's own
// name, email, role, and assigned Stores, nobody else's, ever.
export function ProfileCard() {
  const meQuery = useMeQuery();
  const me = meQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {meQuery.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading…
          </p>
        ) : meQuery.isError || !me?.authenticated ? (
          <ErrorState onRetry={() => void meQuery.refetch()} isFetching={meQuery.isFetching} />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="text-foreground">
                {[me.firstName, me.lastName].filter(Boolean).join(" ") || "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="text-foreground">{me.email}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">Role</dt>
              <dd className="text-foreground capitalize">{me.role}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">Stores</dt>
              <dd className="text-foreground">
                {me.stores && me.stores.length > 0
                  ? me.stores.map((store) => store.name).join(", ")
                  : "None"}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
