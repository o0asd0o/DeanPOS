import { useNavigate, useSearch } from "@tanstack/react-router";
import { UserPlusIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Sheet, SheetContent } from "ui";

import type { RoleFilter } from "@/components/ListToolbar.tsx";
import type { UserListSortKey } from "./helpers.ts";
import { EMPLOYEES_PAGE_SIZE } from "./helpers.ts";
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
  const storesQuery = useStoresQuery();
  const meQuery = useMeQuery();

  // The toolbar's filters, the sort, and the page are URL state (the route's
  // validateSearch), so a filtered view survives a trip to a row's editor;
  // `replace` keeps back/forward clear of every keystroke. The list query is
  // a server page of that state.
  const { role, store, q, sort, page } = useSearch({ from: "/_shell/employees" });
  // `to` is the path — a search-only navigate from a `from` route id resolves
  // against the id as if it were a path and lands on NotFound.
  const navigate = useNavigate();
  // Any filter or sort change starts back at page 1 — a stale page number in
  // the URL would otherwise land on a page that no longer exists.
  const setRole = (role: RoleFilter) =>
    navigate({ to: "/employees", search: { role, store, q, sort, page: 1 }, replace: true });
  const setStore = (store: string) =>
    navigate({ to: "/employees", search: { role, store, q, sort, page: 1 }, replace: true });
  const setQuery = (q: string) =>
    navigate({ to: "/employees", search: { role, store, q, sort, page: 1 }, replace: true });
  const setSort = (key: UserListSortKey) =>
    navigate({
      to: "/employees",
      search: {
        role,
        store,
        q,
        sort:
          sort.key === key
            ? { key, direction: sort.direction === "asc" ? "desc" : "asc" }
            : { key, direction: "asc" },
        page: 1,
      },
      replace: true,
    });
  const setPage = (page: number) =>
    navigate({ to: "/employees", search: { role, store, q, sort, page }, replace: true });

  const usersQuery = useUsersQuery({
    page,
    perPage: EMPLOYEES_PAGE_SIZE,
    role,
    storeId: store === "all" ? undefined : store,
    search: q === "" ? undefined : q,
    sort,
  });

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

  // Roster summary from the server envelope (record 076): the headline
  // counts the whole visible roster, independent of the current filter. The
  // instructional line stays while loading (or after an error).
  const totalCount = usersQuery.data?.totalCount ?? 0;
  const activeCount = usersQuery.data?.activeCount ?? 0;
  const usersLoaded = !usersQuery.isPending && !usersQuery.isError;
  const subtitle =
    usersLoaded && totalCount > 0
      ? `${totalCount} employee${totalCount === 1 ? "" : "s"} · ${activeCount} active`
      : "Who can sign in, what they may do, and where they work.";

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

  const handleReactivate = (user: UserOutput) => {
    if (reactivateUser.isPending) return;
    reactivateUser.mutate(
      { id: user.id },
      { onSuccess: () => announce(`${user.email} reactivated`) },
    );
  };
  const onClearFilters = () =>
    navigate({
      to: "/employees",
      search: { role: "all", store: "all", q: "", sort, page: 1 },
      replace: true,
    });

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
            <UserPlusIcon />
            Add employee
          </Button>
        )}
      </div>
      <UserListCard
        data={usersQuery.data}
        stores={storesQuery.data ?? []}
        isPending={isPending}
        isError={isError}
        isFetching={isFetching}
        refetch={refetchAll}
        isAdmin={isAdmin}
        callerId={callerId}
        editingId={editor.mode === "edit" ? editor.user.id : null}
        role={role}
        onRoleChange={setRole}
        store={store}
        onStoreChange={setStore}
        query={q}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        onClearFilters={onClearFilters}
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
