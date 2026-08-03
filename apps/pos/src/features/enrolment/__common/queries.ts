import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

// Runs on mount (record 056 Q5): a terminal already holding a token never
// sees the enrolment form, because this routes it to "/" first.
export function useTerminalMeQuery() {
  const { orpc } = useRouteContext({ from: "/enrol" });
  return useQuery(orpc.terminal.me.queryOptions());
}

export function useEnrolMutation() {
  const { orpc } = useRouteContext({ from: "/enrol" });
  return useMutation(orpc.terminal.enrol.mutationOptions());
}
