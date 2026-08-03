import { useMutation } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

// The Device-token procedure the Override prompt calls on Approve — the
// server verifies the approver (verifyOverrideAsOf), never the PIN.
export function useRecordOverrideMutation() {
  const { orpc } = useRouteContext({ from: "/" });
  return useMutation(orpc.terminal.recordOverride.mutationOptions());
}
