import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui";

import { useDeactivatePaymentMethodMutation } from "./__common/queries.ts";
import type { PaymentMethodOutput } from "./helpers.ts";

// The deactivation confirmation (record 041's copy rule, structurally the
// Store/User pattern). Reactivation is not confirmed; only this is.
export function DeactivateDialog({
  method,
  open,
  onOpenChange,
  onDeactivated,
}: {
  method: PaymentMethodOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeactivated: (name: string) => void;
}) {
  const deactivateMethod = useDeactivatePaymentMethodMutation();

  const handleDeactivate = async () => {
    if (deactivateMethod.isPending) return;
    const result = await deactivateMethod.mutateAsync({ id: method.id });
    if (!result) return;
    onDeactivated(method.name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate {method.name}?</DialogTitle>
          <DialogDescription>
            This method stops being offered at the till, sales already recorded against it stay
            attributed to it, and Reactivate brings it back
          </DialogDescription>
        </DialogHeader>
        {deactivateMethod.isError && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t update the payment method
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button danger aria-disabled={deactivateMethod.isPending} onClick={handleDeactivate}>
            {deactivateMethod.isPending ? "Deactivating…" : "Deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
