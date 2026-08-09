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
  activeVariantCount: z.number().int().nonnegative(),
});

export const catalogMenuItemListInputSchema = z.object({
  categoryId: z.string().optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(10),
  status: z.enum(["all", "live", "draft", "archived"]).default("all"),
  search: z.string().max(100).optional(),
  sort: z
    .object({
      key: z.enum(["name", "price", "sortOrder"]),
      direction: z.enum(["asc", "desc"]),
    })
    .default({ key: "sortOrder", direction: "asc" }),
});

export const menuItemListOutputSchema = z.object({
  items: z.array(menuItemOutputSchema),
  count: z.number(),
  page: z.number(),
  perPage: z.number(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
  totalCount: z.number(),
  activeCount: z.number(),
  liveCount: z.number(),
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

export const catalogReadAddOnSchema = z.object({
  id: z.string(),
  name: z.string(),
  delta: catalogDeltaSchema,
  maximum: z.number().int().positive().nullable(),
  sortOrder: z.number().int(),
});

export const catalogReadVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceCentavos: z.number().int(),
  sortOrder: z.number().int(),
  available: z.boolean(),
});

export const catalogReadMenuItemSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  categoryId: z.string(),
  name: z.string(),
  priceCentavos: z.number().int(),
  sortOrder: z.number().int(),
  modifierGroups: z.array(catalogReadModifierGroupSchema),
  addOns: z.array(catalogReadAddOnSchema),
  variants: z.array(catalogReadVariantSchema),
  available: z.boolean(),
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
export const catalogReadDiscountSchema = z.object({
  id: z.string(),
  name: catalogNameSchema,
  type: z.enum(["percent", "amount"]),
  scope: z.enum(["order", "line"]),
  value: z.number().int().nullable(),
  requiresOverride: z.boolean(),
  vatExempt: z.boolean(),
  requiresReference: z.boolean(),
  referenceLabel: z.string().nullable(),
});
export const catalogReadOutputSchema = z.object({
  categories: z.array(categoryOutputSchema),
  menuItems: z.array(catalogReadMenuItemSchema),
  discounts: z.array(catalogReadDiscountSchema),
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

const catalogOptionListPageSchema = z.object({
  items: z.array(z.unknown()),
  count: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});

export const catalogOptionUsageSchema = z.enum(["all", "inuse", "needsattention", "unused"]);
const catalogOptionPageInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(100),
  search: z.string().max(100).optional(),
  usage: catalogOptionUsageSchema.default("all"),
});
const catalogOptionSortSchema = z.object({
  key: z.enum(["name", "rule", "delta", "maximum", "linked", "status"]),
  direction: z.enum(["asc", "desc"]),
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
export const modifierGroupListInputSchema = catalogOptionPageInputSchema.extend({
  sort: catalogOptionSortSchema.default({ key: "name", direction: "asc" }),
});
export const modifierGroupListOutputSchema = catalogOptionListPageSchema.extend({
  items: z.array(modifierGroupOutputSchema),
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
export const catalogListModifiersInputSchema = z.object({
  groupId: z.string(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(100),
});
export const modifierListOutputSchema = catalogOptionListPageSchema.extend({
  items: z.array(modifierOutputSchema),
});

export const catalogMenuItemModifierGroupInputSchema = z.object({
  menuItemId: z.string(),
  modifierGroupId: z.string(),
});
export const catalogListLinkedModifierGroupsForItemInputSchema = z.object({
  menuItemId: z.string(),
});

export const addOnOutputSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  delta: catalogDeltaSchema,
  maximum: z.number().int().positive().nullable(),
  sortOrder: z.number().int(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  linkedToCount: z.number().int().nonnegative(),
});
export const addOnListInputSchema = catalogOptionPageInputSchema.extend({
  sort: catalogOptionSortSchema.default({ key: "name", direction: "asc" }),
});
export const addOnListOutputSchema = catalogOptionListPageSchema.extend({
  items: z.array(addOnOutputSchema),
});

export const catalogAddOnCreateInputSchema = z.object({
  name: catalogNameSchema,
  delta: catalogDeltaSchema,
  maximum: z.number().int().positive().nullable().optional(),
});
export const catalogAddOnUpdateInputSchema = catalogAddOnCreateInputSchema.extend({
  id: z.string(),
});

const catalogDiscountTypeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("percent"),
    value: z.number().int().min(1).max(10_000).nullable(),
    scope: z.enum(["order", "line"]),
  }),
  z.object({
    type: z.literal("amount"),
    value: z.number().int().positive().nullable(),
    scope: z.literal("order"),
  }),
]);

export const discountOutputSchema = z.object({
  id: z.string(),
  discountId: z.string(),
  tenantId: z.string(),
  name: catalogNameSchema,
  type: z.enum(["percent", "amount"]),
  scope: z.enum(["order", "line"]),
  value: z.number().int().nullable(),
  requiresOverride: z.boolean(),
  vatExempt: z.boolean(),
  requiresReference: z.boolean(),
  referenceLabel: z.string().nullable(),
  archivedAt: z.date().nullable(),
  effectiveFrom: z.date(),
  createdAt: z.date(),
});
const catalogDiscountFieldsSchema = z.object({
  name: catalogNameSchema,
  requiresOverride: z.boolean(),
  vatExempt: z.boolean(),
  requiresReference: z.boolean(),
  referenceLabel: z.string().trim().max(100).nullable(),
});
export const catalogDiscountCreateInputSchema = catalogDiscountFieldsSchema
  .and(catalogDiscountTypeSchema)
  .refine((input) => !input.requiresReference || Boolean(input.referenceLabel?.trim()), {
    message: "Reference label is required",
    path: ["referenceLabel"],
  });
// `id` is the lineage discountId, never a version-row id.
export const catalogDiscountUpdateInputSchema = z
  .object({ id: z.string() })
  .and(catalogDiscountCreateInputSchema);
export const catalogMenuItemAddOnInputSchema = z.object({
  menuItemId: z.string(),
  addOnId: z.string(),
});
export const catalogListLinkedAddOnsForItemInputSchema = z.object({
  menuItemId: z.string(),
});
