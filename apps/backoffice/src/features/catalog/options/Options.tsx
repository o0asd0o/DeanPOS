import { useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "ui";

import {
  useArchiveModifierGroupMutation,
  useMeQuery,
  useModifierGroupsQuery,
  useAddOnsQuery,
  useArchiveAddOnMutation,
  useReactivateAddOnMutation,
  useReactivateModifierGroupMutation,
} from "./__common/queries.ts";
import type { ModifierGroupOutput } from "./helpers.ts";
import { ModifierGroupEditor } from "./ModifierGroupEditor.tsx";
import { ModifierGroupListCard } from "./ModifierGroupListCard.tsx";
import { ModifierListSheet } from "./ModifierListSheet.tsx";
import { AddOnListCard } from "./AddOnListCard.tsx";
import { AddOnForm } from "./AddOnForm.tsx";

type EditorState =
  | { mode: "closed" }
  | { mode: "group"; group: ModifierGroupOutput | null }
  | { mode: "addon"; addOn: import("./helpers.ts").AddOnOutput | null };

// Options screen (catalog issue 03): tenant-level ModifierGroups library.
// List shape from record 038; editor is 049/050 SheetForm. No toast — live regions.
export function Options() {
  const groupsQuery = useModifierGroupsQuery();
  const addOnsQuery = useAddOnsQuery();
  const meQuery = useMeQuery();
  const role = meQuery.data?.authenticated === true ? meQuery.data.role : null;
  const canMutate = role === "admin" || role === "manager";
  const [announcement, setAnnouncement] = useState<{
    text: string;
    slot: 0 | 1;
  }>({
    text: "",
    slot: 0,
  });
  const announce = (text: string) =>
    setAnnouncement((prev) => ({ text, slot: prev.slot === 0 ? 1 : 0 }));

  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const lastOpenEditor = useRef<EditorState>({ mode: "group", group: null });
  if (editor.mode !== "closed") lastOpenEditor.current = editor;
  const shownEditor =
    editor.mode === "closed" ? lastOpenEditor.current : editor;
  const opener = useRef<HTMLElement | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const [modifierSheetGroupId, setModifierSheetGroupId] = useState<
    string | null
  >(null);
  const modifierSheetGroup = modifierSheetGroupId
    ? (groupsQuery.data?.find((g) => g.id === modifierSheetGroupId) ?? null)
    : null;

  const [pendingArchiveGroup, setPendingArchiveGroup] =
    useState<ModifierGroupOutput | null>(null);

  const archiveGroup = useArchiveModifierGroupMutation();
  const reactivateGroup = useReactivateModifierGroupMutation();
  const archiveAddOn = useArchiveAddOnMutation();
  const reactivateAddOn = useReactivateAddOnMutation();

  const openCreateGroup = () => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "group", group: null });
  };
  const openCreateAddOn = () => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "addon", addOn: null });
  };
  const openEditGroup = (group: ModifierGroupOutput) => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "group", group });
  };
  const closeEditor = () => {
    setEditor({ mode: "closed" });
    opener.current?.focus();
  };
  const handleSaved = (message: string) => {
    announce(message);
    setInlineError(null);
    closeEditor();
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
          <h1 className="text-xl font-semibold">Options</h1>
          <p className="text-sm text-muted-foreground">
            Manage the choices and extras available on menu items.
          </p>
        </div>
      </div>
      <Tabs defaultValue="groups" className="flex flex-col gap-4">
        <TabsList variant="underline" aria-label="Options library">
          <TabsTrigger value="groups">Modifier groups</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
        </TabsList>
        <TabsContent value="groups">
          <div className="flex items-center justify-between gap-3 pb-4">
            <div>
              <h2 className="font-medium">Modifier groups</h2>
              <p className="text-sm text-muted-foreground">
                Set the choices available for each menu item.
              </p>
            </div>
            {canMutate ? (
              <Button onClick={openCreateGroup} className="tap-target">
                Add modifier group
              </Button>
            ) : null}
          </div>
          <ModifierGroupListCard
            groups={groupsQuery.data}
            isPending={groupsQuery.isPending}
            isError={groupsQuery.isError}
            isFetching={groupsQuery.isFetching}
            refetch={() => groupsQuery.refetch()}
            canMutate={canMutate}
            editingGroupId={
              editor.mode === "group" && editor.group ? editor.group.id : null
            }
            onEditGroup={openEditGroup}
            onArchiveGroup={setPendingArchiveGroup}
            onReactivateGroup={async (group) => {
              setInlineError(null);
              const result = await reactivateGroup.mutateAsync({
                id: group.id,
              });
              if (!result) {
                setInlineError("Couldn't reactivate the group.");
                return;
              }
              announce(`${group.name} reactivated`);
            }}
            onOpenModifiers={(group) => setModifierSheetGroupId(group.id)}
            inlineError={inlineError}
          />
        </TabsContent>
        <TabsContent value="addons">
          <div className="flex items-center justify-between gap-3 pb-4">
            <div>
              <h2 className="font-medium">Add-ons</h2>
              <p className="text-sm text-muted-foreground">
                Manage optional extras linked from menu items.
              </p>
            </div>
            {canMutate ? (
              <Button onClick={openCreateAddOn}>Add add-on</Button>
            ) : null}
          </div>
          <AddOnListCard
            addOns={addOnsQuery.data}
            canMutate={canMutate}
            onEdit={(addOn) => setEditor({ mode: "addon", addOn })}
            onArchive={(addOn) =>
              void archiveAddOn.mutateAsync({ id: addOn.id })
            }
            onReactivate={(addOn) =>
              void reactivateAddOn.mutateAsync({ id: addOn.id })
            }
          />
        </TabsContent>
      </Tabs>

      {/* Group editor sheet */}
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
          {shownEditor.mode === "addon" ? (
            <AddOnForm
              addOn={shownEditor.addOn}
              onSaved={handleSaved}
              onCancel={closeEditor}
            />
          ) : (
            shownEditor.mode !== "closed" && (
              <ModifierGroupEditor
                key={
                  shownEditor.mode === "group"
                    ? shownEditor.group
                      ? `group-${shownEditor.group.id}`
                      : "group-create"
                    : "group-create"
                }
                mode={
                  shownEditor.mode === "group"
                    ? { kind: "group", group: shownEditor.group }
                    : { kind: "group", group: null }
                }
                onSaved={handleSaved}
                onCancel={closeEditor}
              />
            )
          )}
        </SheetContent>
      </Sheet>

      {/* Modifier list sheet */}
      {modifierSheetGroup ? (
        <ModifierListSheet
          group={modifierSheetGroup}
          open={true}
          onOpenChange={(open) => {
            if (!open) setModifierSheetGroupId(null);
          }}
          onAnnounce={announce}
          canMutate={canMutate}
        />
      ) : null}

      {/* Archive group confirmation */}
      <Dialog
        open={pendingArchiveGroup !== null}
        onOpenChange={(o) => {
          if (!o) setPendingArchiveGroup(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {pendingArchiveGroup?.name}?</DialogTitle>
            <DialogDescription>
              This modifier group will be hidden from new orders. You can
              reactivate it later.
            </DialogDescription>
          </DialogHeader>
          {archiveGroup.isError ? (
            <div
              role="alert"
              className="rounded-md bg-status-danger-tint p-3 text-sm"
            >
              Couldn't archive the group.
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              danger
              aria-disabled={archiveGroup.isPending}
              onClick={async () => {
                if (!pendingArchiveGroup || archiveGroup.isPending) return;
                setInlineError(null);
                const result = await archiveGroup.mutateAsync({
                  id: pendingArchiveGroup.id,
                });
                if (!result) {
                  setInlineError("Couldn't archive the group.");
                  return;
                }
                announce(`${pendingArchiveGroup.name} archived`);
                setPendingArchiveGroup(null);
              }}
            >
              {archiveGroup.isPending ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
