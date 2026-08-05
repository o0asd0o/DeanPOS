import { useRef, useState } from "react";
import { Sheet, SheetContent } from "ui";

import { ArchiveCategoryDialog } from "./category/ArchiveCategoryDialog.tsx";
import { CategoryEditor } from "./category/CategoryEditor.tsx";
import { CategoryRail } from "./category/CategoryRail.tsx";
import {
  useCategoriesQuery,
  useReactivateCategoryMutation,
  useReorderCategoryMutation,
} from "./category/__common/queries.ts";
import { ArchiveMenuItemDialog } from "./menu-item/ArchiveMenuItemDialog.tsx";
import { MenuItemEditor } from "./menu-item/MenuItemEditor.tsx";
import { MenuItemListCard } from "./menu-item/MenuItemListCard.tsx";
import {
  useMenuItemsQuery,
  useReactivateMenuItemMutation,
  useReorderMenuItemMutation,
} from "./menu-item/__common/queries.ts";
import type { CategoryOutput, MenuItemOutput } from "./helpers.ts";
import { reorderSteps } from "./helpers.ts";

type CategoryEditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; category: CategoryOutput };

type MenuItemEditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; item: MenuItemOutput };

// Catalog screen (issue 01): left Categories rail + MenuItem list Card (record 038).
export function Catalog() {
  const categoriesQuery = useCategoriesQuery();
  const menuItemsQuery = useMenuItemsQuery();
  const reorderCategory = useReorderCategoryMutation();
  const reorderMenuItem = useReorderMenuItemMutation();
  const reactivateCategory = useReactivateCategoryMutation();
  const reactivateMenuItem = useReactivateMenuItemMutation();

  const [announcement, setAnnouncement] = useState<{
    text: string;
    slot: 0 | 1;
  }>({
    text: "",
    slot: 0,
  });
  const announce = (text: string) =>
    setAnnouncement((prev) => ({ text, slot: prev.slot === 0 ? 1 : 0 }));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const categories = categoriesQuery.data;
  const selected =
    categories?.find((category) => category.id === selectedId) ??
    categories?.find((category) => category.archivedAt === null) ??
    null;

  const [categoryEditor, setCategoryEditor] = useState<CategoryEditorState>({
    mode: "closed",
  });
  const lastCategoryEditor = useRef<CategoryEditorState>({ mode: "create" });
  if (categoryEditor.mode !== "closed") lastCategoryEditor.current = categoryEditor;
  const shownCategoryEditor =
    categoryEditor.mode === "closed" ? lastCategoryEditor.current : categoryEditor;

  const [menuItemEditor, setMenuItemEditor] = useState<MenuItemEditorState>({
    mode: "closed",
  });
  const lastMenuItemEditor = useRef<MenuItemEditorState>({ mode: "create" });
  if (menuItemEditor.mode !== "closed") lastMenuItemEditor.current = menuItemEditor;
  const shownMenuItemEditor =
    menuItemEditor.mode === "closed" ? lastMenuItemEditor.current : menuItemEditor;

  const [archiveCategoryTarget, setArchiveCategoryTarget] = useState<CategoryOutput | null>(null);
  const lastArchiveCategory = useRef<CategoryOutput | null>(null);
  if (archiveCategoryTarget) lastArchiveCategory.current = archiveCategoryTarget;
  const shownArchiveCategory = archiveCategoryTarget ?? lastArchiveCategory.current;

  const [archiveItemTarget, setArchiveItemTarget] = useState<MenuItemOutput | null>(null);
  const lastArchiveItem = useRef<MenuItemOutput | null>(null);
  if (archiveItemTarget) lastArchiveItem.current = archiveItemTarget;
  const shownArchiveItem = archiveItemTarget ?? lastArchiveItem.current;

  const [reorderingCategories, setReorderingCategories] = useState(false);
  const [reorderingItems, setReorderingItems] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const openCategoryCreate = () => {
    opener.current = document.activeElement as HTMLElement;
    setCategoryEditor({ mode: "create" });
  };
  const openCategoryRename = (category: CategoryOutput) => {
    opener.current = document.activeElement as HTMLElement;
    setCategoryEditor({ mode: "edit", category });
  };
  const closeCategoryEditor = () => {
    setCategoryEditor({ mode: "closed" });
    opener.current?.focus();
  };

  const openMenuItemCreate = () => {
    if (!selected) return;
    opener.current = document.activeElement as HTMLElement;
    setMenuItemEditor({ mode: "create" });
  };
  const closeMenuItemEditor = () => {
    setMenuItemEditor({ mode: "closed" });
    opener.current?.focus();
  };

  const handleReorderCategory = async (categoryId: string, fromIndex: number, toIndex: number) => {
    const plan = reorderSteps(fromIndex, toIndex);
    if (!plan || reorderCategory.isPending) return;
    setReorderingCategories(true);
    try {
      for (let step = 0; step < plan.steps; step += 1) {
        const result = await reorderCategory.mutateAsync({
          id: categoryId,
          direction: plan.direction,
        });
        if (!result) break;
      }
      announce("Category reordered");
    } finally {
      setReorderingCategories(false);
    }
  };

  const handleReorderMenuItem = async (itemId: string, fromIndex: number, toIndex: number) => {
    const plan = reorderSteps(fromIndex, toIndex);
    if (!plan || reorderMenuItem.isPending) return;
    setReorderingItems(true);
    try {
      for (let step = 0; step < plan.steps; step += 1) {
        const result = await reorderMenuItem.mutateAsync({
          id: itemId,
          direction: plan.direction,
        });
        if (!result) break;
      }
      announce("Menu item reordered");
    } finally {
      setReorderingItems(false);
    }
  };

  const activeItemCount = (menuItemsQuery.data ?? []).filter(
    (item) =>
      shownArchiveCategory !== null &&
      item.categoryId === shownArchiveCategory.id &&
      item.archivedAt === null,
  ).length;

  return (
    <div className="flex flex-col gap-4 p-4">
      <p role="status" className="sr-only">
        {announcement.slot === 0 ? announcement.text : ""}
      </p>
      <p role="status" className="sr-only">
        {announcement.slot === 1 ? announcement.text : ""}
      </p>
      <div>
        <h1 className="text-xl font-semibold">Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Categories organize the terminal grid. Menu items stay drafts until they have a variant.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <CategoryRail
            categories={categoriesQuery.data}
            isPending={categoriesQuery.isPending}
            isError={categoriesQuery.isError}
            isFetching={categoriesQuery.isFetching}
            refetch={() => void categoriesQuery.refetch()}
            selectedId={selected?.id ?? null}
            onSelect={(category) => setSelectedId(category.id)}
            onAdd={openCategoryCreate}
            onRename={openCategoryRename}
            onReorder={handleReorderCategory}
            onArchive={setArchiveCategoryTarget}
            onReactivate={async (category) => {
              if (reactivateCategory.isPending) return;
              const result = await reactivateCategory.mutateAsync({
                id: category.id,
              });
              if (!result) return;
              announce(`${category.name} reactivated`);
            }}
            reordering={reorderingCategories}
          />
        </div>
        <div className="lg:col-span-3">
          <MenuItemListCard
            category={selected}
            menuItems={menuItemsQuery.data}
            isPending={menuItemsQuery.isPending}
            isError={menuItemsQuery.isError}
            isFetching={menuItemsQuery.isFetching}
            refetch={() => void menuItemsQuery.refetch()}
            onAdd={openMenuItemCreate}
            onArchive={setArchiveItemTarget}
            onReactivate={async (item) => {
              if (reactivateMenuItem.isPending) return;
              const result = await reactivateMenuItem.mutateAsync({
                id: item.id,
              });
              if (!result) return;
              announce(`${item.name} reactivated`);
            }}
            onReorder={handleReorderMenuItem}
            reordering={reorderingItems}
          />
        </div>
      </div>

      <Sheet
        modal={false}
        open={categoryEditor.mode !== "closed"}
        onOpenChange={(open) => {
          if (!open) closeCategoryEditor();
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="detached-panel inset-y-4 right-4 h-auto rounded-2xl border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        >
          {shownCategoryEditor.mode !== "closed" && (
            <CategoryEditor
              key={
                shownCategoryEditor.mode === "edit"
                  ? `edit-${shownCategoryEditor.category.id}`
                  : "create-category"
              }
              category={shownCategoryEditor.mode === "edit" ? shownCategoryEditor.category : null}
              onSaved={(category) => {
                setSelectedId(category.id);
                announce(categoryEditor.mode === "edit" ? "Category saved" : "Category created");
                closeCategoryEditor();
              }}
              onCancel={closeCategoryEditor}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        modal={false}
        open={menuItemEditor.mode !== "closed"}
        onOpenChange={(open) => {
          if (!open) closeMenuItemEditor();
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="detached-panel inset-y-4 right-4 h-auto rounded-2xl border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        >
          {shownMenuItemEditor.mode !== "closed" && selected && (
            <MenuItemEditor
              key={
                shownMenuItemEditor.mode === "edit"
                  ? `edit-${shownMenuItemEditor.item.id}`
                  : "create-menu-item"
              }
              menuItem={shownMenuItemEditor.mode === "edit" ? shownMenuItemEditor.item : null}
              categories={categoriesQuery.data ?? []}
              defaultCategoryId={
                shownMenuItemEditor.mode === "edit"
                  ? shownMenuItemEditor.item.categoryId
                  : selected.id
              }
              onSaved={(item) => {
                setSelectedId(item.categoryId);
                announce(menuItemEditor.mode === "edit" ? "Menu item saved" : "Menu item created");
                closeMenuItemEditor();
              }}
              onCancel={closeMenuItemEditor}
            />
          )}
        </SheetContent>
      </Sheet>

      {shownArchiveCategory && (
        <ArchiveCategoryDialog
          category={shownArchiveCategory}
          menuItemCount={activeItemCount}
          open={archiveCategoryTarget !== null}
          onOpenChange={(open) => {
            if (!open) setArchiveCategoryTarget(null);
          }}
          onArchived={(name) => {
            setArchiveCategoryTarget(null);
            announce(`${name} archived`);
          }}
        />
      )}
      {shownArchiveItem && (
        <ArchiveMenuItemDialog
          menuItem={shownArchiveItem}
          open={archiveItemTarget !== null}
          onOpenChange={(open) => {
            if (!open) setArchiveItemTarget(null);
          }}
          onArchived={(name) => {
            setArchiveItemTarget(null);
            announce(`${name} archived`);
          }}
        />
      )}
    </div>
  );
}
