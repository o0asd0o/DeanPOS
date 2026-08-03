import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

export function usePaymentMethodsQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/payment-methods" });
  return useQuery(orpc.paymentMethod.list.queryOptions());
}

export function useStoresQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/payment-methods" });
  return useQuery(orpc.store.list.queryOptions());
}

export function useMeQuery() {
  const { orpc } = useRouteContext({ from: "/_shell/payment-methods" });
  return useQuery(orpc.auth.me.queryOptions());
}

// Every mutation below invalidates the same list query on success — the
// list `Card` is the only place any of these results is read back.
function useInvalidatePaymentMethods() {
  const { orpc } = useRouteContext({ from: "/_shell/payment-methods" });
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.paymentMethod.list.queryKey() });
}

export function useCreatePaymentMethodMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/payment-methods" });
  const invalidate = useInvalidatePaymentMethods();
  return useMutation(
    orpc.paymentMethod.create.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Method created", error: "Couldn't save the payment method" },
    }),
  );
}

export function useUpdatePaymentMethodMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/payment-methods" });
  const invalidate = useInvalidatePaymentMethods();
  return useMutation(
    orpc.paymentMethod.update.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Saved", error: "Couldn't save the payment method" },
    }),
  );
}

export function useDeactivatePaymentMethodMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/payment-methods" });
  const invalidate = useInvalidatePaymentMethods();
  return useMutation(
    orpc.paymentMethod.deactivate.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Method deactivated", error: "Couldn't update the payment method" },
    }),
  );
}

export function useReactivatePaymentMethodMutation() {
  const { orpc } = useRouteContext({ from: "/_shell/payment-methods" });
  const invalidate = useInvalidatePaymentMethods();
  return useMutation(
    orpc.paymentMethod.reactivate.mutationOptions({
      onSuccess: invalidate,
      meta: { success: "Method reactivated", error: "Couldn't update the payment method" },
    }),
  );
}
