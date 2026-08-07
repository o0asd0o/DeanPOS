import { useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useRouteContext } from "@tanstack/react-router";
import { ArrowLeftIcon, CheckIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { MoneyInput } from "@/components/MoneyInput.tsx";
import {
  useMoveMenuItemOnDetailMutation,
  useRenameMenuItemOnDetailMutation,
  useSetMenuItemPriceOnDetailMutation,
} from "./__common/queries.ts";
import {
  useArchiveVariantMutation,
  useCreateVariantMutation,
  useReactivateVariantMutation,
  useRenameVariantMutation,
  useReorderVariantMutation,
  useSetVariantPriceMutation,
} from "@/features/catalog/variant/__common/queries.ts";
import { ArchiveVariantDialog } from "@/features/catalog/variant/ArchiveVariantDialog.tsx";
import {
  centavosToEditorString,
  parsePriceInput,
  reorderSteps,
  type VariantOutput,
} from "@/features/catalog/helpers.ts";
import { ModifierGroupPicker } from "@/features/catalog/variant/ModifierGroupPicker.tsx";
import { SortableVariantRow } from "@/features/catalog/variant/SortableVariantRow.tsx";
import { VariantEditorSheet } from "@/features/catalog/variant/VariantEditorSheet.tsx";

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
  const setMenuItemPrice = useSetMenuItemPriceOnDetailMutation(id);

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
  const [priceError, setPriceError] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const itemBusy = renameMenuItem.isPending || moveMenuItem.isPending || setMenuItemPrice.isPending;
  const variantBusy =
    createVariant.isPending || renameVariant.isPending || setVariantPrice.isPending;
  const reordering = reorderVariant.isPending;

  const menuItem = menuItemQuery.data ?? null;
  const categories = categoriesQuery.data ?? [];
  const activeCategories = categories.filter((category) => category.archivedAt === null);
  const categoryName = categories.find((c) => c.id === menuItem?.categoryId)?.name ?? "Unknown";

  const variants = useMemo(() => {
    const rows = variantsQuery.data ?? [];
    return rows.slice().sort((a, b) => {
      if (a.archivedAt === null && b.archivedAt !== null) return -1;
      if (a.archivedAt !== null && b.archivedAt === null) return 1;
      return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
    });
  }, [variantsQuery.data]);
  const activeVariants = variants.filter((row) => row.archivedAt === null);
  const [orderedVariants, setOrderedVariants] = useState<VariantOutput[]>([]);
  useEffect(() => {
    setOrderedVariants(activeVariants);
  }, [variantsQuery.data]);
  const archivedVariants = variants.filter((row) => row.archivedAt !== null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const form = useForm({
    defaultValues: { name: "", price: "" },
    onSubmit: async ({ value }) => {
      if (!menuItem) return;
      const name = value.name.trim();
      if (name.length < 1 || name.length > NAME_MAX) return;
      const parsed = parsePriceInput(value.price);
      if (!parsed.ok) {
        setPriceError("Enter pesos and centavos, like 120.00");
        return;
      }
      if (parsed.value < 0) {
        setPriceError("Price cannot be negative");
        return;
      }
      setPriceError(null);
      setItemFailed(false);
      if (name !== menuItem.name) {
        const renamed = await renameMenuItem.mutateAsync({ id: menuItem.id, name });
        if (!renamed) {
          setItemFailed(true);
          return;
        }
      }
      if (parsed.value !== menuItem.priceCentavos) {
        const priced = await setMenuItemPrice.mutateAsync({
          id: menuItem.id,
          priceCentavos: parsed.value,
        });
        if (!priced) {
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
    form.setFieldValue("price", centavosToEditorString(menuItem.priceCentavos));
  }, [menuItem?.id, menuItem?.name, menuItem?.priceCentavos]);

  const gate = useSubmitGate(form, { busy: itemBusy });

  const handleCategorySave = async () => {
    if (!menuItem || !pendingCategoryId || pendingCategoryId === menuItem.categoryId) {
      setEditingCategory(false);
      setPendingCategoryId(null);
      return;
    }
    const moved = await moveMenuItem.mutateAsync({
      id: menuItem.id,
      categoryId: pendingCategoryId,
    });
    if (moved) {
      announce("Category changed");
      void versionQuery.refetch();
    }
    setEditingCategory(false);
    setPendingCategoryId(null);
  };

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

  const handleReorder = async (variantId: string, fromIndex: number, toIndex: number) => {
    const plan = reorderSteps(fromIndex, toIndex);
    if (!plan || reordering) return;
    for (let step = 0; step < plan.steps; step += 1) {
      const result = await reorderVariant.mutateAsync({ id: variantId, direction: plan.direction });
      if (!result) break;
    }
    announce("Variant reordered");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || reordering) return;
    const fromIndex = orderedVariants.findIndex((v) => v.id === active.id);
    const toIndex = orderedVariants.findIndex((v) => v.id === over.id);
    if (fromIndex < 0 || toIndex < 0) return;
    setOrderedVariants((rows) => arrayMove(rows, fromIndex, toIndex));
    void handleReorder(String(active.id), fromIndex, toIndex);
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{menuItem.name}</h1>
            {editingCategory ? (
              <div className="flex items-center gap-1">
                <Select
                  value={pendingCategoryId ?? menuItem.categoryId}
                  onValueChange={setPendingCategoryId}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Save category"
                  disabled={moveMenuItem.isPending}
                  onClick={handleCategorySave}
                >
                  <CheckIcon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Cancel"
                  onClick={() => {
                    setEditingCategory(false);
                    setPendingCategoryId(null);
                  }}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="group inline-flex items-center gap-1"
                onClick={() => {
                  setPendingCategoryId(menuItem.categoryId);
                  setEditingCategory(true);
                }}
              >
                <Badge variant="secondary">{categoryName}</Badge>
                <PencilIcon
                  aria-hidden="true"
                  className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                />
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Variants are optional sizes or options that override the base price.
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
            <form.Field name="price">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor="menu-item-detail-price">Price</label>
                  <MoneyInput
                    id="menu-item-detail-price"
                    name={field.name}
                    required
                    aria-invalid={priceError !== null}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(v) => {
                      setPriceError(null);
                      field.handleChange(v);
                    }}
                  />
                </div>
              )}
            </form.Field>
            {priceError && (
              <div
                role="alert"
                className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
              >
                {priceError}
              </div>
            )}
            {itemFailed && (
              <div
                role="alert"
                className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
              >
                Couldn&rsquo;t save the menu item
              </div>
            )}
            <div className="flex justify-end">
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
          <h2 className="text-lg font-semibold">Modifier groups</h2>
          <p className="text-sm text-muted-foreground">
            Apply to this item regardless of which variant is chosen.
          </p>
          <ModifierGroupPicker menuItemId={id} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Variants</h2>
              <p className="text-sm text-muted-foreground">
                Optional sizes or options with their own prices.
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
              No variants yet.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedVariants.map((v) => v.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="overflow-x-auto py-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <span className="sr-only">Reorder</span>
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderedVariants.map((variant) => (
                        <SortableVariantRow
                          key={variant.id}
                          variant={variant}
                          disabled={reordering || orderedVariants.length < 2}
                          onEdit={openEditVariant}
                          onArchive={setArchiveTarget}
                        />
                      ))}
                      {archivedVariants.map((variant) => (
                        <SortableVariantRow
                          key={variant.id}
                          variant={variant}
                          disabled
                          onEdit={openEditVariant}
                          onArchive={setArchiveTarget}
                          onReactivate={handleReactivate}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </SortableContext>
            </DndContext>
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
        <SheetContent
          side="right"
          showCloseButton={false}
          className="detached-panel inset-y-4 right-4 h-auto rounded-2xl border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        >
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
