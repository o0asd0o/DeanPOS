import { ErrorState } from "@/components/ErrorState.tsx";
import { usePingQuery } from "./__common/queries.ts";

// The worked example of ADR-0009: the route's single feature component.
// A successful ping with no row is a migration invariant, not an empty
// state — .scratch/decisions/009 — so it renders the same error block.
export function Ping() {
  const { data, isPending, isError, isFetching, refetch } = usePingQuery();

  if (isPending) return <p role="status">Loading…</p>;
  if (isError || !data) {
    return <ErrorState onRetry={() => refetch()} isFetching={isFetching} />;
  }

  return <p>{data.message}</p>;
}
