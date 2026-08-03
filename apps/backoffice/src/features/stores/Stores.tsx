import { useRef, useState } from "react";

import { DeactivateDialog } from "./DeactivateDialog.tsx";
import { useMeQuery, useReactivateStoreMutation, useStoresQuery } from "./__common/queries.ts";
import type { StoreOutput } from "./helpers.ts";
import { StoreEditor } from "./StoreEditor.tsx";
import { StoreListCard } from "./StoreListCard.tsx";

type EditorState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; store: StoreOutput };

// The Store management screen (record 038 §1): one always-present live
// region, the list `Card`, then the editor `Card` when open. No lofi mock —
// records 038/039/040 are the contract.
export function Stores() {
  const storesQuery = useStoresQuery();
  const meQuery = useMeQuery();
  const isAdmin = meQuery.data?.authenticated === true && meQuery.data.role === "admin";

  const [announcement, setAnnouncement] = useState("");
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [deactivateTarget, setDeactivateTarget] = useState<StoreOutput | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const reactivateStore = useReactivateStoreMutation();
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const openCreate = () => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "create" });
  };
  const openEdit = (store: StoreOutput) => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "edit", store });
  };
  const closeEditor = () => {
    setEditor({ mode: "closed" });
    opener.current?.focus();
  };
  const handleSaved = () => {
    setAnnouncement(editor.mode === "edit" ? "Saved" : "Store created");
    closeEditor();
  };

  const handleReactivate = async (store: StoreOutput) => {
    if (reactivateStore.isPending) return;
    setReactivatingId(store.id);
    const result = await reactivateStore.mutateAsync({ id: store.id });
    setReactivatingId(null);
    if (!result) return;
    setAnnouncement(`${store.name} reactivated`);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <StoreListCard
        stores={storesQuery.data}
        isPending={storesQuery.isPending}
        isError={storesQuery.isError}
        isFetching={storesQuery.isFetching}
        refetch={() => storesQuery.refetch()}
        isAdmin={isAdmin}
        editingId={editor.mode === "edit" ? editor.store.id : null}
        reactivatingId={reactivatingId}
        onAdd={openCreate}
        onEdit={openEdit}
        onDeactivate={setDeactivateTarget}
        onReactivate={handleReactivate}
      />
      {editor.mode !== "closed" && (
        <StoreEditor
          store={editor.mode === "edit" ? editor.store : null}
          onSaved={handleSaved}
          onCancel={closeEditor}
          onAnnounce={setAnnouncement}
        />
      )}
      {deactivateTarget && (
        <DeactivateDialog
          store={deactivateTarget}
          onOpenChange={(open) => {
            if (!open) setDeactivateTarget(null);
          }}
          onDeactivated={(name) => {
            setDeactivateTarget(null);
            setAnnouncement(`${name} deactivated`);
          }}
        />
      )}
    </div>
  );
}
