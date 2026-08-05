import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { CheckIcon, XIcon } from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useSubmitGate,
} from "ui";

import { MoneyInput } from "@/components/MoneyInput.tsx";
import { SheetForm } from "@/components/SheetForm.tsx";
import {
  useCreateMenuItemMutation,
  useMoveMenuItemMutation,
  useRenameMenuItemMutation,
  useSetMenuItemPriceMutation,
} from "./__common/queries.ts";
import {
  centavosToEditorString,
  parsePriceInput,
  type CategoryOutput,
  type MenuItemOutput,
} from "@/features/catalog/helpers.ts";

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
  const setMenuItemPrice = useSetMenuItemPriceMutation();
  const saving =
    createMenuItem.isPending ||
    renameMenuItem.isPending ||
    moveMenuItem.isPending ||
    setMenuItemPrice.isPending;
  const failed =
    createMenuItem.isError ||
    renameMenuItem.isError ||
    moveMenuItem.isError ||
    setMenuItemPrice.isError;
  const activeCategories = categories.filter((category) => category.archivedAt === null);

  const [priceError, setPriceError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      name: menuItem?.name ?? "",
      categoryId: menuItem?.categoryId ?? defaultCategoryId,
      price: menuItem ? centavosToEditorString(menuItem.priceCentavos) : "",
    },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      if (name.length < 1 || name.length > NAME_MAX) return;
      if (!value.categoryId) return;
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

      if (!menuItem) {
        const created = await createMenuItem.mutateAsync({
          categoryId: value.categoryId,
          name,
          priceCentavos: parsed.value,
        });
        if (!created) return;
        onSaved(created);
        return;
      }

      let current = menuItem;
      if (name !== menuItem.name) {
        const renamed = await renameMenuItem.mutateAsync({ id: menuItem.id, name });
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
      if (parsed.value !== menuItem.priceCentavos) {
        const priced = await setMenuItemPrice.mutateAsync({
          id: menuItem.id,
          priceCentavos: parsed.value,
        });
        if (!priced) return;
        current = priced;
      }
      onSaved(current);
    },
  });
  const gate = useSubmitGate(form, { busy: saving });

  return (
    <SheetForm
      title={menuItem ? `Edit ${menuItem.name}` : "New menu item"}
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
          </div>
        )}
      </form.Field>
      <form.Field name="price">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="menu-item-price">Price</label>
            <MoneyInput
              id="menu-item-price"
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
      <form.Field name="categoryId">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label id="menu-item-category-label">Category</label>
            <Select
              name={field.name}
              required
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value)}
            >
              <SelectTrigger className="w-full" aria-labelledby="menu-item-category-label">
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
          </div>
        )}
      </form.Field>
      {priceError && (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground">
          {priceError}
        </div>
      )}
      {failed && !priceError && (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground">
          Couldn&rsquo;t {menuItem ? "update" : "create"} the menu item
        </div>
      )}
    </SheetForm>
  );
}
