import { useRef, useState } from "react";
import { Button, Sheet, SheetContent } from "ui";

import { DeactivateDialog } from "./DeactivateDialog.tsx";
import {
  useMeQuery,
  useReactivateUserMutation,
  useStoresQuery,
  useUsersQuery,
} from "./__common/queries.ts";
import type { UserOutput } from "./helpers.ts";
import { UserEditor } from "./UserEditor.tsx";
import { UserListCard } from "./UserListCard.tsx";

type EditorState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; user: UserOutput };

// The User management screen (record 044 §1): one always-present live
// region, the list `Card`, then the editor `Card` when open — the same
// shape record 038 settled for Stores.
export function Users() {
  const usersQuery = useUsersQuery();
  const storesQuery = useStoresQuery();
  const meQuery = useMeQuery();

  // Both queries gate screen state (finding 5): a failed `store.list` must
  // never silently read as "no stores" — that misreports every User's
  // assignment and tells the editor to add a Store first.
  const isPending = usersQuery.isPending || storesQuery.isPending;
  const isError = usersQuery.isError || storesQuery.isError;
  const isFetching = usersQuery.isFetching || storesQuery.isFetching;
  const refetchAll = () => {
    void usersQuery.refetch();
    void storesQuery.refetch();
  };
  const isAdmin = meQuery.data?.authenticated === true && meQuery.data.role === "admin";
  const callerId = meQuery.data?.authenticated === true ? meQuery.data.userId : undefined;

  // Two alternating regions, not one string (record 039 finding 4):
  // identical consecutive messages would otherwise produce no DOM mutation
  // on a single node and go unannounced.
  const [announcement, setAnnouncement] = useState<{ text: string; slot: 0 | 1 }>({
    text: "",
    slot: 0,
  });
  const announce = (text: string) =>
    setAnnouncement((prev) => ({ text, slot: prev.slot === 0 ? 1 : 0 }));

  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [deactivateTarget, setDeactivateTarget] = useState<UserOutput | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const reactivateUser = useReactivateUserMutation();
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [reactivateFailed, setReactivateFailed] = useState(false);

  const openCreate = () => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "create" });
  };
  const openEdit = (user: UserOutput) => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "edit", user });
  };
  const closeEditor = () => {
    setEditor({ mode: "closed" });
    opener.current?.focus();
  };
  const handleSaved = () => {
    announce(editor.mode === "edit" ? "Saved" : "User created");
    closeEditor();
  };

  const handleReactivate = async (user: UserOutput) => {
    if (reactivateUser.isPending) return;
    setReactivateFailed(false);
    setReactivatingId(user.id);
    try {
      const result = await reactivateUser.mutateAsync({ id: user.id });
      if (!result) return;
      announce(`${user.email} reactivated`);
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
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Who can sign in, what they may do, and where they work.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="tap-target">
            Add user
          </Button>
        )}
      </div>
      <UserListCard
        users={usersQuery.data}
        stores={storesQuery.data ?? []}
        isPending={isPending}
        isError={isError}
        isFetching={isFetching}
        refetch={refetchAll}
        isAdmin={isAdmin}
        callerId={callerId}
        editingId={editor.mode === "edit" ? editor.user.id : null}
        reactivatingId={reactivatingId}
        reactivateFailed={reactivateFailed}
        onEdit={openEdit}
        onDeactivate={setDeactivateTarget}
        onReactivate={handleReactivate}
      />
      {/* Not modal: the list behind stays clickable, so one row's editor can be
          swapped straight for another's (record 039 finding 1). */}
      <Sheet
        modal={false}
        open={editor.mode !== "closed" && !isPending && !isError}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <SheetContent
          side="right"
          className="detached-panel inset-y-4 right-4 h-auto rounded-2xl border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        >
          {editor.mode !== "closed" && !isPending && !isError && (
            <UserEditor
              key={editor.mode === "edit" ? `edit-${editor.user.id}` : "create"}
              user={editor.mode === "edit" ? editor.user : null}
              onSaved={handleSaved}
              onCancel={closeEditor}
              onAnnounce={announce}
            />
          )}
        </SheetContent>
      </Sheet>
      {deactivateTarget && (
        <DeactivateDialog
          user={deactivateTarget}
          onOpenChange={(open) => {
            if (!open) setDeactivateTarget(null);
          }}
          onDeactivated={(email) => {
            setDeactivateTarget(null);
            announce(`${email} deactivated`);
          }}
        />
      )}
    </div>
  );
}
