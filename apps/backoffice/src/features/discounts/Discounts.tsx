import { useRef, useState } from "react";
import { Button, Sheet, SheetContent } from "ui";
import { PlusIcon } from "lucide-react";
import { useSearch } from "@tanstack/react-router";

import { DiscountEditor } from "./DiscountEditor.tsx";
import { ArchiveDiscountDialog } from "./ArchiveDiscountDialog.tsx";
import { DiscountListCard } from "./DiscountListCard.tsx";
import { useDiscountsQuery, useReactivateDiscountMutation } from "./__common/queries.ts";
import type { DiscountOutput } from "./helpers.ts";

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; discount: DiscountOutput };

export function Discounts() {
  const query = useDiscountsQuery();
  const reactivate = useReactivateDiscountMutation();
  const [archiveTarget, setArchiveTarget] = useState<DiscountOutput | null>(null);
  const [reactivateError, setReactivateError] = useState(false);
  useSearch({ from: "/_shell/discounts" });
  const [announcement, setAnnouncement] = useState({ text: "", slot: 0 as 0 | 1 });
  const announce = (text: string) =>
    setAnnouncement((previous) => ({ text, slot: previous.slot === 0 ? 1 : 0 }));
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const lastOpenEditor = useRef<EditorState>({ mode: "create" });
  if (editor.mode !== "closed") lastOpenEditor.current = editor;
  const shownEditor = editor.mode === "closed" ? lastOpenEditor.current : editor;
  const opener = useRef<HTMLElement | null>(null);
  const openCreate = () => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "create" });
  };
  const openEdit = (discount: DiscountOutput) => {
    opener.current = document.activeElement as HTMLElement;
    setEditor({ mode: "edit", discount });
  };
  const closeEditor = () => {
    setEditor({ mode: "closed" });
    opener.current?.focus();
  };
  const statusText = query.data
    ? `tenant-wide · ${query.data.length} configured`
    : "Tenant-wide named reductions";
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
          <h1 className="text-xl font-semibold">Discounts</h1>
          <p className="text-sm text-muted-foreground">{statusText}</p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon />
          New discount
        </Button>
      </div>
      <div role="note" className="rounded-xl bg-muted p-4 text-sm">
        <strong>Applied by a person.</strong> Discounts have no conditions, schedules, codes, or
        stacking rules. A cashier chooses the named reduction at the sale.
      </div>
      <DiscountListCard
        discounts={query.data ?? []}
        onCreate={openCreate}
        onEdit={openEdit}
        onArchive={(discount) => {
          setArchiveTarget(discount);
        }}
        onReactivate={async (discount) => {
          setReactivateError(false);
          const result = await reactivate.mutateAsync({ id: discount.discountId });
          if (result) announce(`${discount.name} reactivated`);
          else setReactivateError(true);
        }}
      />
      {reactivateError ? (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm">
          Couldn&rsquo;t reactivate the discount. An active discount with the same name may already
          exist.
        </div>
      ) : null}
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
          {shownEditor.mode !== "closed" ? (
            <DiscountEditor
              key={shownEditor.mode === "edit" ? `edit-${shownEditor.discount.id}` : "create"}
              discount={shownEditor.mode === "edit" ? shownEditor.discount : null}
              onSaved={(message) => {
                announce(message);
                closeEditor();
              }}
              onCancel={closeEditor}
            />
          ) : null}
        </SheetContent>
      </Sheet>
      {archiveTarget ? (
        <ArchiveDiscountDialog
          discount={archiveTarget}
          open={archiveTarget !== null}
          onOpenChange={(open) => {
            if (!open) setArchiveTarget(null);
          }}
          onArchived={(name) => {
            setArchiveTarget(null);
            announce(`${name} archived`);
          }}
        />
      ) : null}
    </div>
  );
}
