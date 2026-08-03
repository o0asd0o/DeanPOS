import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

import { writeDeviceToken } from "@/lib/device-token.ts";

// Runs on mount (record 056 Q5): a terminal already holding a token never
// sees the enrolment form, because this routes it to "/" first.
export function useTerminalMeQuery() {
  const { orpc } = useRouteContext({ from: "/enrol" });
  return useQuery(orpc.terminal.me.queryOptions());
}

// The plaintext token is written to storage here and stripped before the
// result reaches MutationCache — the cache never retains it (record 056).
export function useEnrolMutation() {
  const { orpc } = useRouteContext({ from: "/enrol" });
  return useMutation({
    mutationKey: orpc.terminal.enrol.mutationKey(),
    mutationFn: async (input: { secret: string }) => {
      const outcome = await orpc.terminal.enrol.call(input);
      if (!outcome.ok) return outcome;
      const { token, ...identity } = outcome;
      writeDeviceToken(token, identity);
      return identity;
    },
  });
}
