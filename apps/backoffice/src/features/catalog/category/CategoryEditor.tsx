import { useForm } from "@tanstack/react-form";
import { CheckIcon, XIcon } from "lucide-react";
import { Button, Input, useSubmitGate } from "ui";

import { SheetForm } from "@/components/SheetForm.tsx";
import { useCreateCategoryMutation, useRenameCategoryMutation } from "./__common/queries.ts";
import type { CategoryOutput } from "@/features/catalog/helpers.ts";

const NAME_MAX = 60;

export function CategoryEditor({
  category,
  onSaved,
  onCancel,
}: {
  category: CategoryOutput | null;
  onSaved: (category: CategoryOutput) => void;
  onCancel: () => void;
}) {
  const createCategory = useCreateCategoryMutation();
  const renameCategory = useRenameCategoryMutation();
  const saving = createCategory.isPending || renameCategory.isPending;
  const failed = createCategory.isError || renameCategory.isError;

  const form = useForm({
    defaultValues: { name: category?.name ?? "" },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      if (name.length < 1 || name.length > NAME_MAX) return;
      const saved = category
        ? await renameCategory.mutateAsync({ id: category.id, name })
        : await createCategory.mutateAsync({ name });
      if (!saved) return;
      onSaved(saved);
    },
  });
  const gate = useSubmitGate(form, { busy: saving });

  return (
    <SheetForm
      title={category ? `Rename ${category.name}` : "New category"}
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
            {category
              ? saving
                ? "Saving…"
                : "Save changes"
              : saving
                ? "Creating…"
                : "Create category"}
          </Button>
        </>
      }
    >
      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-2">
            <label htmlFor="category-name">Name</label>
            <Input
              id="category-name"
              name={field.name}
              placeholder="Ulam"
              required
              autoFocus
              maxLength={NAME_MAX}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">1–{NAME_MAX} characters. Emoji allowed.</p>
          </div>
        )}
      </form.Field>
      {failed && (
        <div role="alert" className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground">
          Couldn&rsquo;t {category ? "update" : "create"} the category
        </div>
      )}
    </SheetForm>
  );
}
