import { useRef, useState } from "react";
import { Button, Sheet, SheetContent } from "ui";

import {
  useArchiveModifierGroupMutation,
  useArchiveModifierMutation,
  useMeQuery,
  useModifierGroupsQuery,
  useReactivateModifierGroupMutation,
  useReactivateModifierMutation,
} from "./__common/queries.ts";
import type { ModifierGroupOutput, ModifierOutput } from "./helpers.ts";
import { ModifierGroupEditor } from "./ModifierGroupEditor.tsx";
import { ModifierGroupListCard } from "./ModifierGroupListCard.tsx";

type EditorState =
  | { mode: "closed" }
  | { mode: "group"; group: ModifierGroupOutput | null }
  | { mode: "modifier"; group: ModifierGroupOutput; modifier: ModifierOutput | null };

// Options screen (catalog issue 03): tenant-level ModifierGroups library.
// List shape from record 038; editor is 049/050 SheetForm. No toast — live regions.
export function Options() {
  const groupsQuery = useModifierGroupsQuery();
  const meQuery = useMeQuery();
  const role = meQuery.data?.authenticated === true ? meQuery.data.role : null;
  const canMutate = role === "admin" || role === "manager";

  const [announcement, setAnnouncement] = useState<{ text: string; slot: 0 | 1 }>({
    text: "",
    slot: 0,
  });
  const announce = (text: string) =>
    setAnnouncement((prev) => ({ text, slot: prev.slot === 0 ? 1 : 0 }));

  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const lastOpenEditor = useRef<EditorState>({ mode: "group", group: null });
  if (editor.mode !== "closed") lastOpenEditor.current = editor;
  const shownEditor = editor.mode === "closed" ? lastOpenEditor.current : editor;
  const opener = useRef<HTMLElement | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const archiveGroup = useArchiveModifierGroupMutation();
  const reactivateGroup = useReactivateModifierGroupMutation();
  const archiveModifier = useArchiveModifierMutation();
  const reactivateModifier = useReactivateModifierMutation();

  const openCreateGroup = () => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "group", group: null });
  };
  const openEditGroup = (group: ModifierGroupOutput) => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "group", group });
  };
  const openAddModifier = (group: ModifierGroupOutput) => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "modifier", group, modifier: null });
  };
  const openEditModifier = (group: ModifierGroupOutput, modifier: ModifierOutput) => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "modifier", group, modifier });
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
            Shared modifier groups for the menu — created once, linked many times.
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
        editingGroupId={editor.mode === "group" && editor.group ? editor.group.id : null}
        onEditGroup={openEditGroup}
        onArchiveGroup={async (group) => {
          setInlineError(null);
          const result = await archiveGroup.mutateAsync({ id: group.id });
          if (!result) {
            setInlineError("Couldn't archive the group.");
            return;
          }
          announce(`${group.name} archived`);
        }}
        onReactivateGroup={async (group) => {
          setInlineError(null);
          const result = await reactivateGroup.mutateAsync({ id: group.id });
          if (!result) {
            setInlineError("Couldn't reactivate the group.");
            return;
          }
          announce(`${group.name} reactivated`);
        }}
        onAddModifier={openAddModifier}
        onEditModifier={openEditModifier}
        onArchiveModifier={async (modifier) => {
          setInlineError(null);
          const result = await archiveModifier.mutateAsync({ id: modifier.id });
          if (!result) {
            setInlineError("Couldn't archive the modifier.");
            return;
          }
          announce(`${modifier.name} archived`);
        }}
        onReactivateModifier={async (modifier) => {
          setInlineError(null);
          const result = await reactivateModifier.mutateAsync({ id: modifier.id });
          if (!result) {
            setInlineError("Couldn't reactivate the modifier.");
            return;
          }
          announce(`${modifier.name} reactivated`);
        }}
        inlineError={inlineError}
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
            <ModifierGroupEditor
              key={
                shownEditor.mode === "group"
                  ? shownEditor.group
                    ? `group-${shownEditor.group.id}`
                    : "group-create"
                  : shownEditor.modifier
                    ? `mod-${shownEditor.modifier.id}`
                    : `mod-create-${shownEditor.group.id}`
              }
              mode={
                shownEditor.mode === "group"
                  ? { kind: "group", group: shownEditor.group }
                  : {
                      kind: "modifier",
                      group: shownEditor.group,
                      modifier: shownEditor.modifier,
                    }
              }
              onSaved={handleSaved}
              onCancel={closeEditor}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
