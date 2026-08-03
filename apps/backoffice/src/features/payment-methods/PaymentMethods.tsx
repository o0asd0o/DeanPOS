import { useRef, useState } from "react";
import { Button, Card, CardContent, Sheet, SheetContent } from "ui";

import { DeactivateDialog } from "./DeactivateDialog.tsx";
import { PaymentMethodEditor } from "./PaymentMethodEditor.tsx";
import { PaymentMethodListCard } from "./PaymentMethodListCard.tsx";
import {
  useMeQuery,
  usePaymentMethodsQuery,
  useReactivatePaymentMethodMutation,
  useStoresQuery,
} from "./__common/queries.ts";
import type { PaymentMethodOutput } from "./helpers.ts";

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; method: PaymentMethodOutput };

// The payment-methods screen (issue 08, record 054): its own screen, not a
// section of the settings dialog — one always-present live region, the list
// `Card`, then the editor sheet when open.
export function PaymentMethods() {
  const methodsQuery = usePaymentMethodsQuery();
  const storesQuery = useStoresQuery();
  const stores = (storesQuery.data ?? []).filter((store) => store.active);
  const meQuery = useMeQuery();
  const isAdmin = meQuery.data?.authenticated === true && meQuery.data.role === "admin";

  const [announcement, setAnnouncement] = useState<{ text: string; slot: 0 | 1 }>({
    text: "",
    slot: 0,
  });
  const announce = (text: string) =>
    setAnnouncement((prev) => ({ text, slot: prev.slot === 0 ? 1 : 0 }));

  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const lastOpenEditor = useRef<EditorState>({ mode: "create" });
  if (editor.mode !== "closed") lastOpenEditor.current = editor;
  const shownEditor = editor.mode === "closed" ? lastOpenEditor.current : editor;
  const [deactivateTarget, setDeactivateTarget] = useState<PaymentMethodOutput | null>(null);
  const lastDeactivateTarget = useRef<PaymentMethodOutput | null>(null);
  if (deactivateTarget) lastDeactivateTarget.current = deactivateTarget;
  const shownDeactivateTarget = deactivateTarget ?? lastDeactivateTarget.current;
  const opener = useRef<HTMLElement | null>(null);

  const reactivateMethod = useReactivatePaymentMethodMutation();
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [reactivateFailed, setReactivateFailed] = useState(false);

  const openCreate = () => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "create" });
  };
  const openEdit = (method: PaymentMethodOutput) => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "edit", method });
  };
  const closeEditor = () => {
    setEditor({ mode: "closed" });
    opener.current?.focus();
  };
  const handleSaved = () => {
    announce(editor.mode === "edit" ? "Saved" : "Method created");
    closeEditor();
  };

  const handleReactivate = async (method: PaymentMethodOutput) => {
    if (reactivateMethod.isPending) return;
    setReactivateFailed(false);
    setReactivatingId(method.id);
    try {
      const result = await reactivateMethod.mutateAsync({ id: method.id });
      if (!result) return;
      announce(`${method.name} reactivated`);
    } catch {
      setReactivateFailed(true);
    } finally {
      setReactivatingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <p role="status" className="sr-only">
        {announcement.slot === 0 ? announcement.text : ""}
      </p>
      <p role="status" className="sr-only">
        {announcement.slot === 1 ? announcement.text : ""}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Payment methods</h1>
          <p className="text-sm text-muted-foreground">
            What a cashier can record a sale against, and where.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="tap-target">
            Add method
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-1 text-sm text-foreground">
          <p className="font-medium">A new tenant starts with cash only</p>
          <p className="text-muted-foreground">
            Only cash reaches the drawer. Every other method records an amount and authorises
            nothing — no gateway, no QR code, no settlement. The name is recorded on each sale as it
            stood at the time, so renaming a method never changes past sales.
          </p>
        </CardContent>
      </Card>
      <PaymentMethodListCard
        methods={methodsQuery.data}
        stores={stores}
        isPending={methodsQuery.isPending}
        isError={methodsQuery.isError}
        isFetching={methodsQuery.isFetching}
        refetch={() => methodsQuery.refetch()}
        isAdmin={isAdmin}
        editingId={editor.mode === "edit" ? editor.method.id : null}
        reactivatingId={reactivatingId}
        reactivateFailed={reactivateFailed}
        onEdit={openEdit}
        onDeactivate={setDeactivateTarget}
        onReactivate={handleReactivate}
      />
      <Sheet
        modal={false}
        open={editor.mode !== "closed"}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="detached-panel inset-y-4 right-4 h-auto rounded-2xl border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        >
          {shownEditor.mode !== "closed" && (
            <PaymentMethodEditor
              key={shownEditor.mode === "edit" ? `edit-${shownEditor.method.id}` : "create"}
              method={shownEditor.mode === "edit" ? shownEditor.method : null}
              onSaved={handleSaved}
              onCancel={closeEditor}
            />
          )}
        </SheetContent>
      </Sheet>
      {shownDeactivateTarget && (
        <DeactivateDialog
          method={shownDeactivateTarget}
          open={deactivateTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeactivateTarget(null);
          }}
          onDeactivated={(name) => {
            setDeactivateTarget(null);
            announce(`${name} deactivated`);
          }}
        />
      )}
    </div>
  );
}
