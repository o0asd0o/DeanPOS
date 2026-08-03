import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

export function useSettingsQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/settings" });
  return useQuery(orpc.settings.get.queryOptions());
}

export function useUpdateSettingsMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/settings" });
  const queryClient = useQueryClient();
  return useMutation(
    orpc.settings.update.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.settings.get.queryKey() }),
    }),
  );
}
