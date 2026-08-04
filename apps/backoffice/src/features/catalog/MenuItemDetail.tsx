import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useRouteContext } from "@tanstack/react-router";
import { ArrowLeftIcon, CheckIcon, PlusIcon } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Sheet,
  SheetContent,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  useSubmitGate,
} from "ui";

import { ErrorState } from "@/components/ErrorState.tsx";
import {
  useArchiveVariantMutation,
  useCreateVariantMutation,
  useMoveMenuItemOnDetailMutation,
  useReactivateVariantMutation,
  useRenameMenuItemOnDetailMutation,
  useRenameVariantMutation,
  useReorderVariantMutation,
  useSetVariantPriceMutation,
} from "./__common/queries.ts";
import { ArchiveVariantDialog } from "./ArchiveVariantDialog.tsx";
import { VariantEditorSheet } from "./VariantEditorSheet.tsx";
import { VariantRow } from "./VariantRow.tsx";
import type { VariantOutput } from "./helpers.ts";

const NAME_MAX = 60;

type VariantEditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; variant: VariantOutput };

// Full-page MenuItem editor at /catalog/$id (issue 02). Variants open a Sheet from this route — never Sheet-in-Sheet.
export function MenuItemDetail() {
  const { id } = useParams({ from: "/_shell/catalog_/$id" });
  const { orpc } = useRouteContext({ from: "/_shell/catalog_/$id" });

  const menuItemQuery = useQuery(orpc.catalog.getMenuItem.queryOptions({ input: { id } }));
  const variantsQuery = useQuery(
    orpc.catalog.listVariants.queryOptions({ input: { menuItemId: id } }),
  );
  const categoriesQuery = useQuery(orpc.catalog.listCategories.queryOptions());
  const storesQuery = useQuery(orpc.store.list.queryOptions());
  const storeId = storesQuery.data?.[0]?.id ?? null;
  const versionQuery = useQuery({
    ...orpc.catalog.version.queryOptions({ input: { storeId: storeId ?? "" } }),
    enabled: Boolean(storeId),
  });

  const createVariant = useCreateVariantMutation(id);
  const renameVariant = useRenameVariantMutation(id);
  const setVariantPrice = useSetVariantPriceMutation(id);
  const archiveVariant = useArchiveVariantMutation(id);
  const reactivateVariant = useReactivateVariantMutation(id);
  const reorderVariant = useReorderVariantMutation(id);
  const renameMenuItem = useRenameMenuItemOnDetailMutation(id);
  const moveMenuItem = useMoveMenuItemOnDetailMutation(id);

  const [announcement, setAnnouncement] = useState<{ text: string; slot: 0 | 1 }>({
    text: "",
    slot: 0,
  });
  const announce = (text: string) =>
    setAnnouncement((prev) => ({ text, slot: prev.slot === 0 ? 1 : 0 }));

  const [variantEditor, setVariantEditor] = useState<VariantEditorState>({ mode: "closed" });
  const lastVariantEditor = useRef<VariantEditorState>({ mode: "create" });
  if (variantEditor.mode !== "closed") lastVariantEditor.current = variantEditor;
  const shownVariantEditor =
    variantEditor.mode === "closed" ? lastVariantEditor.current : variantEditor;

  const [variantFailed, setVariantFailed] = useState(false);
  const [itemFailed, setItemFailed] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<VariantOutput | null>(null);
  const [archiveFailed, setArchiveFailed] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const itemBusy = renameMenuItem.isPending || moveMenuItem.isPending;
  const variantBusy =
    createVariant.isPending || renameVariant.isPending || setVariantPrice.isPending;
  const reordering = reorderVariant.isPending;

  const menuItem = menuItemQuery.data ?? null;
  const categories = categoriesQuery.data ?? [];
  const activeCategories = categories.filter((category) => category.archivedAt === null);

  const variants = useMemo(() => {
    const rows = variantsQuery.data ?? [];
    return rows.slice().sort((a, b) => {
      if (a.archivedAt === null && b.archivedAt !== null) return -1;
      if (a.archivedAt !== null && b.archivedAt === null) return 1;
      return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
    });
  }, [variantsQuery.data]);
  const activeVariants = variants.filter((row) => row.archivedAt === null);

  const form = useForm({
    defaultValues: {
      name: "",
      categoryId: "",
    },
    onSubmit: async ({ value }) => {
      if (!menuItem) return;
      const name = value.name.trim();
      if (name.length < 1 || name.length > NAME_MAX) return;
      if (!value.categoryId) return;
      setItemFailed(false);
      if (name !== menuItem.name) {
        const renamed = await renameMenuItem.mutateAsync({ id: menuItem.id, name });
        if (!renamed) {
          setItemFailed(true);
          return;
        }
      }
      if (value.categoryId !== menuItem.categoryId) {
        const moved = await moveMenuItem.mutateAsync({
          id: menuItem.id,
          categoryId: value.categoryId,
        });
        if (!moved) {
          setItemFailed(true);
          return;
        }
      }
      announce("Menu item saved");
      void versionQuery.refetch();
    },
  });

  useEffect(() => {
    if (!menuItem) return;
    form.setFieldValue("name", menuItem.name);
    form.setFieldValue("categoryId", menuItem.categoryId);
  }, [menuItem?.id, menuItem?.name, menuItem?.categoryId]);

  const gate = useSubmitGate(form, { busy: itemBusy });

  const openCreateVariant = () => {
    opener.current = document.activeElement as HTMLElement;
    setVariantFailed(false);
    setVariantEditor({ mode: "create" });
  };
  const openEditVariant = (variant: VariantOutput) => {
    opener.current = document.activeElement as HTMLElement;
    setVariantFailed(false);
    setVariantEditor({ mode: "edit", variant });
  };
  const closeVariantEditor = () => {
    setVariantEditor({ mode: "closed" });
    opener.current?.focus();
  };

  const handleVariantSave = async (value: { name: string; priceCentavos: number }) => {
    setVariantFailed(false);
    if (shownVariantEditor.mode === "create") {
      const created = await createVariant.mutateAsync({
        menuItemId: id,
        name: value.name,
        priceCentavos: value.priceCentavos,
      });
      if (!created) {
        setVariantFailed(true);
        return;
      }
    } else if (shownVariantEditor.mode === "edit") {
      const current = shownVariantEditor.variant;
      if (value.name !== current.name) {
        const renamed = await renameVariant.mutateAsync({
          id: current.id,
          name: value.name,
        });
        if (!renamed) {
          setVariantFailed(true);
          return;
        }
      }
      if (value.priceCentavos !== current.priceCentavos) {
        const priced = await setVariantPrice.mutateAsync({
          id: current.id,
          priceCentavos: value.priceCentavos,
        });
        if (!priced) {
          setVariantFailed(true);
          return;
        }
      }
    }
    announce("Variant saved");
    void versionQuery.refetch();
    closeVariantEditor();
  };

  const handleArchive = async () => {
    if (!archiveTarget || archiveVariant.isPending) return;
    setArchiveFailed(false);
    const result = await archiveVariant.mutateAsync({ id: archiveTarget.id });
    if (!result) {
      setArchiveFailed(true);
      return;
    }
    const name = archiveTarget.name;
    setArchiveTarget(null);
    announce(`Archived ${name}`);
    void versionQuery.refetch();
  };

  const handleReactivate = async (variant: VariantOutput) => {
    const result = await reactivateVariant.mutateAsync({ id: variant.id });
    if (!result) return;
    announce(`Reactivated ${variant.name}`);
    void versionQuery.refetch();
  };

  const handleMove = async (variant: VariantOutput, direction: "up" | "down") => {
    if (reordering) return;
    const result = await reorderVariant.mutateAsync({ id: variant.id, direction });
    if (!result) return;
    announce("Variant reordered");
  };

  if (menuItemQuery.isPending || variantsQuery.isPending) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <p role="status">Loading…</p>
      </div>
    );
  }

  if (menuItemQuery.isError || !menuItem) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <ErrorState
          onRetry={() => {
            void menuItemQuery.refetch();
            void variantsQuery.refetch();
          }}
          isFetching={menuItemQuery.isFetching}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p role="status" className="sr-only">
        {announcement.slot === 0 ? announcement.text : ""}
      </p>
      <p role="status" className="sr-only">
        {announcement.slot === 1 ? announcement.text : ""}
      </p>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="sm" className="w-fit tap-target" asChild>
            <Link to="/catalog">
              <ArrowLeftIcon />
              Catalog
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">{menuItem.name}</h1>
          <p className="text-sm text-muted-foreground">
            Variants carry the price. A menu item without an active variant is not sellable.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              gate.submit();
            }}
            className="flex flex-col gap-4"
            aria-busy={itemBusy}
          >
            <form.Field name="name">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor="menu-item-detail-name">Name</label>
                  <Input
                    id="menu-item-detail-name"
                    name={field.name}
                    required
                    maxLength={NAME_MAX}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="categoryId">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor="menu-item-detail-category">Category</label>
                  <select
                    id="menu-item-detail-category"
                    name={field.name}
                    required
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  >
                    {activeCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </form.Field>
            {itemFailed && (
              <div
                role="alert"
                className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
              >
                Couldn&rsquo;t save the menu item
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground tabular-nums" role="status">
                {versionQuery.data?.version
                  ? `Catalog version ${versionQuery.data.version.slice(0, 12)}…`
                  : "Catalog version —"}
              </p>
              <Button type="submit" aria-disabled={gate.blocked}>
                <CheckIcon />
                {itemBusy ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Variants</h2>
              <p className="text-sm text-muted-foreground">
                Each variant is a sellable price form of this item.
              </p>
            </div>
            <Button type="button" onClick={openCreateVariant}>
              <PlusIcon />
              Add variant
            </Button>
          </div>

          {variantsQuery.isError ? (
            <ErrorState
              onRetry={() => void variantsQuery.refetch()}
              isFetching={variantsQuery.isFetching}
            />
          ) : variants.length === 0 ? (
            <p role="status" className="text-muted-foreground">
              No variants yet. Add one to make this item sellable.
            </p>
          ) : (
            <div className="overflow-x-auto py-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">
                      <span className="sr-only">Reorder</span>
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((variant) => {
                    const activeIndex = activeVariants.findIndex((row) => row.id === variant.id);
                    return (
                      <VariantRow
                        key={variant.id}
                        variant={variant}
                        index={activeIndex}
                        total={activeVariants.length}
                        reordering={reordering}
                        onEdit={openEditVariant}
                        onArchive={setArchiveTarget}
                        onReactivate={handleReactivate}
                        onMove={handleMove}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={variantEditor.mode !== "closed"}
        onOpenChange={(open) => {
          if (!open) closeVariantEditor();
        }}
        modal={false}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <VariantEditorSheet
            key={shownVariantEditor.mode === "edit" ? shownVariantEditor.variant.id : "create"}
            variant={shownVariantEditor.mode === "edit" ? shownVariantEditor.variant : null}
            busy={variantBusy}
            failed={variantFailed}
            onSave={handleVariantSave}
            onCancel={closeVariantEditor}
          />
        </SheetContent>
      </Sheet>

      {archiveTarget && (
        <ArchiveVariantDialog
          variant={archiveTarget}
          open={archiveTarget !== null}
          busy={archiveVariant.isPending}
          failed={archiveFailed}
          onOpenChange={(open) => {
            if (!open) setArchiveTarget(null);
          }}
          onConfirm={handleArchive}
        />
      )}
    </div>
  );
}
