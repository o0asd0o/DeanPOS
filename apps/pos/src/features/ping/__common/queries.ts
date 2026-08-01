import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

export function usePingQuery() {
  const { orpc } = useRouteContext({ from: "/" });
  return useQuery(orpc.ping.queryOptions());
}
