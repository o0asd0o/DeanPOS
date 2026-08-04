import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

export function useMeQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/account" });
  return useQuery(orpc.auth.me.queryOptions());
}

export function useSetPinMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/account" });
  return useMutation(
    orpc.user.setPin.mutationOptions({
      meta: { success: "PIN saved", error: "Couldn't save the PIN" },
    }),
  );
}
