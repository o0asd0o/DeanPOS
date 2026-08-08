import { useNavigate, useSearch } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button, Sheet, SheetContent } from "ui";

import type { RoleFilter } from "@/components/ListToolbar.tsx";
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

  // Roster summary once the list is in hand; the instructional line stays
  // while loading (or after an error, when the list never arrived).
  const usersLoaded = !usersQuery.isPending && !usersQuery.isError;
  const roster = usersQuery.data ?? [];
  const subtitle =
    usersLoaded && roster.length > 0
      ? `${roster.length} employee${roster.length === 1 ? "" : "s"} · ${
          roster.filter((user) => user.active).length
        } active`
      : "Who can sign in, what they may do, and where they work.";

  // The toolbar's filters are URL state (the route's validateSearch), so a
  // filtered view survives a trip to a row's editor; `replace` keeps
  // back/forward clear of every keystroke.
  const { role, store, q } = useSearch({ from: "/_shell/employees" });
  // `to` is the path — a search-only navigate from a `from` route id resolves
  // against the id as if it were a path and lands on NotFound. The full
  // object (not a spread of `prev`) is what the route's search type wants.
  const navigate = useNavigate();
  const setRole = (role: RoleFilter) =>
    navigate({ to: "/employees", search: { role, store, q }, replace: true });
  const setStore = (store: string) =>
    navigate({ to: "/employees", search: { role, store, q }, replace: true });
  const setQuery = (q: string) =>
    navigate({ to: "/employees", search: { role, store, q }, replace: true });

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
  // Held so the panel still has content while the sheet animates out.
  const lastOpenEditor = useRef<EditorState>({ mode: "create" });
  if (editor.mode !== "closed") lastOpenEditor.current = editor;
  const shownEditor = editor.mode === "closed" ? lastOpenEditor.current : editor;
  const [deactivateTarget, setDeactivateTarget] = useState<UserOutput | null>(null);
  // Held so the dialog still has content while it animates out.
  const lastDeactivateTarget = useRef<UserOutput | null>(null);
  if (deactivateTarget) lastDeactivateTarget.current = deactivateTarget;
  const shownDeactivateTarget = deactivateTarget ?? lastDeactivateTarget.current;
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
          <h1 className="text-xl font-semibold">Employees</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="tap-target">
            Add employee
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
        role={role}
        onRoleChange={setRole}
        store={store}
        onStoreChange={setStore}
        query={q}
        onQueryChange={setQuery}
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
          showCloseButton={false}
          className="detached-panel inset-y-4 right-4 h-auto rounded-2xl border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        >
          {shownEditor.mode !== "closed" && !isPending && !isError && (
            <UserEditor
              key={shownEditor.mode === "edit" ? `edit-${shownEditor.user.id}` : "create"}
              user={shownEditor.mode === "edit" ? shownEditor.user : null}
              onSaved={handleSaved}
              onCancel={closeEditor}
              onAnnounce={announce}
            />
          )}
        </SheetContent>
      </Sheet>
      {shownDeactivateTarget && (
        <DeactivateDialog
          user={shownDeactivateTarget}
          open={deactivateTarget !== null}
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
