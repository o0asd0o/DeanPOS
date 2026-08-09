import { useNavigate, useSearch } from "@tanstack/react-router";
import { InfoIcon, PlusIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle, Button, Sheet, SheetContent } from "ui";

import type { ReachFilter } from "@/components/ListToolbar.tsx";
import { DeactivateDialog } from "./DeactivateDialog.tsx";
import { PaymentMethodEditor } from "./PaymentMethodEditor.tsx";
import { PaymentMethodListCard } from "./PaymentMethodListCard.tsx";
import {
  useMeQuery,
  usePaymentMethodsQuery,
  useReactivatePaymentMethodMutation,
  useStoresQuery,
} from "./__common/queries.ts";
import { paymentMethodReach } from "./helpers.ts";
import type { PaymentMethodOutput } from "./helpers.ts";

// Per-browser, not per-tenant: dismissing a primer is a reading preference,
// and `tenant_settings` is admin-only and audits every change.
const NOTICE_KEY = "deanpos.backoffice.paymentMethodsNoticeDismissed";

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

  // The toolbar's filters are URL state (the route's validateSearch), so a
  // filtered view survives a trip to a row's editor; `replace` keeps
  // back/forward clear of every keystroke. `to` is the path — a search-only
  // navigate from a route id resolves against the id and lands on NotFound.
  const { reach, store, q } = useSearch({ from: "/_shell/payment-methods" });
  const navigate = useNavigate();
  const setSearch = (next: { reach: ReachFilter; store: string; q: string }) =>
    navigate({ to: "/payment-methods", search: next, replace: true });

  // Both queries gate the screen: a failed `store.list` must never read as
  // "no stores", which would misreport every method's reach as No stores.
  const isPending = methodsQuery.isPending || storesQuery.isPending;
  const isError = methodsQuery.isError || storesQuery.isError;
  const refetchAll = () => {
    void methodsQuery.refetch();
    void storesQuery.refetch();
  };

  // The headline counts the whole set, independent of the current filter; the
  // instructional line stays while loading (or after an error).
  const loaded = !isPending && !isError;
  const methods = methodsQuery.data ?? [];
  const liveCount = methods.filter(
    (method) => paymentMethodReach(method, stores) === "live",
  ).length;
  const subtitle =
    loaded && methods.length > 0
      ? `${String(methods.length)} method${methods.length === 1 ? "" : "s"} · ${String(liveCount)} live`
      : "What a cashier can record a sale against, and where.";

  const [announcement, setAnnouncement] = useState<{ text: string; slot: 0 | 1 }>({
    text: "",
    slot: 0,
  });
  const announce = (text: string) =>
    setAnnouncement((prev) => ({ text, slot: prev.slot === 0 ? 1 : 0 }));

  const [noticeDismissed, setNoticeDismissed] = useState(
    () => localStorage.getItem(NOTICE_KEY) === "1",
  );
  const dismissNotice = () => {
    localStorage.setItem(NOTICE_KEY, "1");
    setNoticeDismissed(true);
  };

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
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="tap-target">
            <PlusIcon />
            Add method
          </Button>
        )}
      </div>
      {/* `role="note"`, not the default `alert`: a standing primer, not a live
          message — an `alert` would be read out on every render. */}
      {!noticeDismissed && (
        <Alert role="note" className="pr-12">
          <InfoIcon />
          <AlertTitle className="line-clamp-none">A new tenant starts with cash only</AlertTitle>
          <AlertDescription>
            Only cash reaches the drawer. Every other method records an amount and charges nothing —
            no gateway, no QR generation, no settlement. A QR image is a poster the merchant already
            owns; DeanPOS never verifies that a scan against it was actually paid. The name is
            recorded on each sale as it stood at the time, so renaming a method never changes past
            sales.
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss notice"
            onClick={dismissNotice}
            className="absolute top-2 right-2 text-muted-foreground"
          >
            <XIcon />
          </Button>
        </Alert>
      )}
      <PaymentMethodListCard
        methods={methodsQuery.data}
        stores={stores}
        isPending={isPending}
        isError={isError}
        isFetching={methodsQuery.isFetching || storesQuery.isFetching}
        refetch={refetchAll}
        isAdmin={isAdmin}
        editingId={editor.mode === "edit" ? editor.method.id : null}
        reactivatingId={reactivatingId}
        reactivateFailed={reactivateFailed}
        reach={reach}
        onReachChange={(reach) => setSearch({ reach, store, q })}
        store={store}
        onStoreChange={(store) => setSearch({ reach, store, q })}
        query={q}
        onQueryChange={(q) => setSearch({ reach, store, q })}
        onClearFilters={() => setSearch({ reach: "all", store: "all", q: "" })}
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
