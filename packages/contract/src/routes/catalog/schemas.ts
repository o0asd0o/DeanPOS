import { z } from "zod";

export const catalogNameSchema = z.string().trim().min(1).max(60);
export const catalogEntityIdInputSchema = z.object({ id: z.string() });
export const catalogReorderInputSchema = catalogEntityIdInputSchema.extend({
  direction: z.enum(["up", "down"]),
});

export const categoryOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
});

export const menuItemOutputSchema = categoryOutputSchema.extend({
  categoryId: z.string(),
  priceCentavos: z.number().int(),
});

export const variantOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  menuItemId: z.string(),
  name: z.string(),
  priceCentavos: z.number().int(),
  sortOrder: z.number().int(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
});

// Delta and selection rule schemas used by both the read model and the Options library.
export const catalogSelectionRuleSchema = z.enum(["required-one", "optional-one", "many"]);
export const catalogDeltaKindSchema = z.enum(["absolute", "multiplier"]);
export const catalogDeltaSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("absolute"),
    amountCentavos: z.number().int().min(-100_000).max(100_000),
  }),
  z.object({
    kind: z.literal("multiplier"),
    perMille: z.number().int().min(1).max(10_000),
  }),
]);

// Slim modifier shape for the read model — only what the terminal needs.
export const catalogReadModifierSchema = z.object({
  id: z.string(),
  name: z.string(),
  delta: catalogDeltaSchema,
  sortOrder: z.number().int(),
});

// Group shape embedded in each variant's read model (decision 073: ordered by library sort_order).
export const catalogReadModifierGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  selectionRule: catalogSelectionRuleSchema,
  maximum: z.number().int().positive().nullable(),
  defaultModifierId: z.string().nullable(),
  sortOrder: z.number().int(),
  modifiers: z.array(catalogReadModifierSchema),
});

export const catalogReadVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceCentavos: z.number().int(),
  sortOrder: z.number().int(),
});

export const catalogReadMenuItemSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  categoryId: z.string(),
  name: z.string(),
  priceCentavos: z.number().int(),
  sortOrder: z.number().int(),
  modifierGroups: z.array(catalogReadModifierGroupSchema),
  variants: z.array(catalogReadVariantSchema),
});

export const catalogCategoryCreateInputSchema = z.object({ name: catalogNameSchema });
export const catalogCategoryRenameInputSchema = z.object({
  id: z.string(),
  name: catalogNameSchema,
});

export const catalogMenuItemCreateInputSchema = z.object({
  categoryId: z.string(),
  name: catalogNameSchema,
  priceCentavos: z.number().int(),
});
export const catalogMenuItemSetPriceInputSchema = z.object({
  id: z.string(),
  priceCentavos: z.number().int(),
});
export const catalogMenuItemRenameInputSchema = z.object({
  id: z.string(),
  name: catalogNameSchema,
});
export const catalogMenuItemMoveInputSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
});

export const catalogVariantCreateInputSchema = z.object({
  menuItemId: z.string(),
  name: catalogNameSchema,
  priceCentavos: z.number().int(),
});
export const catalogVariantRenameInputSchema = z.object({
  id: z.string(),
  name: catalogNameSchema,
});
export const catalogVariantSetPriceInputSchema = z.object({
  id: z.string(),
  priceCentavos: z.number().int(),
});
export const catalogListVariantsInputSchema = z.object({ menuItemId: z.string() });

export const catalogReadInputSchema = z.object({ storeId: z.string() });
export const catalogReadOutputSchema = z.object({
  categories: z.array(categoryOutputSchema),
  menuItems: z.array(catalogReadMenuItemSchema),
  version: z.string().regex(/^[0-9a-f]{64}$/),
});
export const catalogVersionOutputSchema = z.object({
  version: z.string().regex(/^[0-9a-f]{64}$/),
});

export const modifierOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  groupId: z.string(),
  name: z.string(),
  delta: catalogDeltaSchema,
  sortOrder: z.number().int(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
});

export const modifierGroupOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  selectionRule: catalogSelectionRuleSchema,
  maximum: z.number().int().positive().nullable(),
  defaultModifierId: z.string().nullable(),
  sortOrder: z.number().int(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  // Query-sourced count of Variant links. Zero until issue 04 builds linking.
  linkedToCount: z.number().int().nonnegative(),
  modifiers: z.array(modifierOutputSchema),
});

export const catalogModifierGroupCreateInputSchema = z.object({
  name: catalogNameSchema,
  selectionRule: catalogSelectionRuleSchema,
  maximum: z.number().int().positive().nullable().optional(),
});
export const catalogModifierGroupUpdateInputSchema = z.object({
  id: z.string(),
  name: catalogNameSchema,
  selectionRule: catalogSelectionRuleSchema,
  maximum: z.number().int().positive().nullable().optional(),
  defaultModifierId: z.string().nullable().optional(),
});

export const catalogModifierCreateInputSchema = z.object({
  groupId: z.string(),
  name: catalogNameSchema,
  delta: catalogDeltaSchema,
});
export const catalogModifierUpdateInputSchema = z.object({
  id: z.string(),
  name: catalogNameSchema,
  delta: catalogDeltaSchema,
});
export const catalogListModifiersInputSchema = z.object({ groupId: z.string() });

export const catalogMenuItemModifierGroupInputSchema = z.object({
  menuItemId: z.string(),
  modifierGroupId: z.string(),
});
export const catalogListLinkedModifierGroupsForItemInputSchema = z.object({
  menuItemId: z.string(),
});
