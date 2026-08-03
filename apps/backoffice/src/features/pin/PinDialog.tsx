import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PasswordInput,
} from "ui";

// Self-service PIN set/change (issue 10, record 058) — one field, no
// `currentPin`: the password session that opens this dialog is already a
// stronger factor than the PIN it writes.
export function PinDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { orpc } = useRouteContext({ from: "/_shell" });
  const setPin = useMutation(
    orpc.user.setPin.mutationOptions({
      meta: { success: "PIN saved", error: "Couldn't save the PIN" },
    }),
  );

  const form = useForm({
    defaultValues: { pin: "" },
    onSubmit: async ({ value }) => {
      try {
        const result = await setPin.mutateAsync({ pin: value.pin });
        if (!result.ok) return;
        form.reset();
        setPin.reset();
        onOpenChange(false);
      } catch {
        // isError is already set on the mutation; swallow so it doesn't
        // also surface as an unhandled promise rejection.
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (setPin.isPending) return;
            void form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <DialogHeader>
            <DialogTitle>Set your PIN</DialogTitle>
            <DialogDescription>
              You use this PIN to unlock a till. It is four to six digits, and nobody else is shown
              it.
            </DialogDescription>
          </DialogHeader>
          <form.Field name="pin">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor="pin">PIN</label>
                <PasswordInput
                  id="pin"
                  name={field.name}
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  minLength={4}
                  pattern="\d{4,6}"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </div>
            )}
          </form.Field>
          {setPin.isError && (
            <div
              role="alert"
              className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
            >
              Couldn&rsquo;t save the PIN
            </div>
          )}
          <DialogFooter className="mt-2 border-t pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" aria-disabled={setPin.isPending}>
              {setPin.isPending ? "Saving…" : "Save PIN"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
