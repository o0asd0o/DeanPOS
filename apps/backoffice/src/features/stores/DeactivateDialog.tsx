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

import { useDeactivateStoreMutation } from "./__common/queries.ts";
import type { StoreOutput } from "./helpers.ts";

// The deactivation confirmation (record 038 §4) — structurally the same as
// `SignOutButton`'s `Dialog`. Reactivation is not confirmed; only this is.
export function DeactivateDialog({
  store,
  onOpenChange,
  onDeactivated,
}: {
  store: StoreOutput;
  onOpenChange: (open: boolean) => void;
  onDeactivated: (name: string) => void;
}) {
  const deactivateStore = useDeactivateStoreMutation();

  const handleDeactivate = async () => {
    if (deactivateStore.isPending) return;
    const result = await deactivateStore.mutateAsync({ id: store.id });
    if (!result) return;
    onDeactivated(store.name);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate {store.name}?</DialogTitle>
          <DialogDescription>
            This store stops being offered for new work, its past sales stay attributed to it, and
            Reactivate brings it back
          </DialogDescription>
        </DialogHeader>
        {deactivateStore.isError && (
          <div
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            Couldn&rsquo;t update the store
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button danger aria-disabled={deactivateStore.isPending} onClick={handleDeactivate}>
            {deactivateStore.isPending ? "Deactivating…" : "Deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
