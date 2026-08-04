import { useForm } from "@tanstack/react-form";
import { CheckIcon, XIcon } from "lucide-react";
import { Button, Input, useSubmitGate } from "ui";

import { SheetForm } from "@/components/SheetForm.tsx";
import {
  useCreateMenuItemMutation,
  useMoveMenuItemMutation,
  useRenameMenuItemMutation,
} from "./__common/queries.ts";
import type { CategoryOutput, MenuItemOutput } from "./helpers.ts";

const NAME_MAX = 60;

export function MenuItemEditor({
  menuItem,
  categories,
  defaultCategoryId,
  onSaved,
  onCancel,
}: {
  menuItem: MenuItemOutput | null;
  categories: CategoryOutput[];
  defaultCategoryId: string;
  onSaved: (item: MenuItemOutput) => void;
  onCancel: () => void;
}) {
  const createMenuItem = useCreateMenuItemMutation();
  const renameMenuItem = useRenameMenuItemMutation();
  const moveMenuItem = useMoveMenuItemMutation();
  const saving =
    createMenuItem.isPending ||
    renameMenuItem.isPending ||
    moveMenuItem.isPending;
  const failed =
    createMenuItem.isError || renameMenuItem.isError || moveMenuItem.isError;
  const activeCategories = categories.filter(
    (category) => category.archivedAt === null,
  );

  const form = useForm({
    defaultValues: {
      name: menuItem?.name ?? "",
      categoryId: menuItem?.categoryId ?? defaultCategoryId,
    },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      if (name.length < 1 || name.length > NAME_MAX) return;
      if (!value.categoryId) return;

      if (!menuItem) {
        const created = await createMenuItem.mutateAsync({
          categoryId: value.categoryId,
          name,
        });
        if (!created) return;
        onSaved(created);
        return;
      }

      let current = menuItem;
      if (name !== menuItem.name) {
        const renamed = await renameMenuItem.mutateAsync({
          id: menuItem.id,
          name,
        });
        if (!renamed) return;
        current = renamed;
      }
      if (value.categoryId !== menuItem.categoryId) {
        const moved = await moveMenuItem.mutateAsync({
          id: menuItem.id,
          categoryId: value.categoryId,
        });
        if (!moved) return;
        current = moved;
      }
      onSaved(current);
    },
  });
  const gate = useSubmitGate(form, { busy: saving });

  return (
    <SheetForm
      title={menuItem ? `Rename ${menuItem.name}` : "New menu item"}
      busy={saving}
      onSubmit={gate.submit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            <XIcon />
            Cancel
          </Button>
          <Button type="submit" aria-disabled={gate.blocked}>
            <CheckIcon />
            {menuItem
              ? saving
                ? "Saving…"
                : "Save changes"
              : saving
                ? "Creating…"
                : "Create menu item"}
          </Button>
        </>
      }
    >
      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="menu-item-name">Name</label>
            <Input
              id="menu-item-name"
              name={field.name}
              placeholder="Adobo"
              required
              autoFocus
              maxLength={NAME_MAX}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              1–{NAME_MAX} characters. Emoji allowed.
            </p>
          </div>
        )}
      </form.Field>
      <form.Field name="categoryId">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="menu-item-category">Category</label>
            <select
              id="menu-item-category"
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
      {failed && (
        <div
          role="alert"
          className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
        >
          Couldn&rsquo;t {menuItem ? "update" : "create"} the menu item
        </div>
      )}
    </SheetForm>
  );
}
