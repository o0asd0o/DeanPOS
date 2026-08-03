import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

// Settings live in a dialog off the account menu, not a route — the read is
// deferred until the dialog is actually visible.
export function useSettingsQuery(enabled: boolean) {
  const { orpc } = useRouteContext({ from: "/_shell" });
  return useQuery({ ...orpc.settings.get.queryOptions(), enabled });
}

export function useUpdateSettingsMutation() {
  const { orpc } = useRouteContext({ from: "/_shell" });
  const queryClient = useQueryClient();
  return useMutation(
    orpc.settings.update.mutationOptions({
      // A server-side refusal resolves `null` rather than rejecting; only a
      // real save invalidates the cached settings.
      onSuccess: (data) => {
        if (data) void queryClient.invalidateQueries({ queryKey: orpc.settings.get.queryKey() });
      },
    }),
  );
}
