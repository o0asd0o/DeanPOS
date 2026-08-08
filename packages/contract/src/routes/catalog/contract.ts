import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  catalogCategoryCreateInputSchema,
  catalogCategoryRenameInputSchema,
  catalogEntityIdInputSchema,
  catalogListLinkedModifierGroupsForItemInputSchema,
  catalogListModifiersInputSchema,
  catalogListVariantsInputSchema,
  catalogMenuItemCreateInputSchema,
  catalogMenuItemModifierGroupInputSchema,
  catalogMenuItemMoveInputSchema,
  catalogMenuItemRenameInputSchema,
  catalogMenuItemSetPriceInputSchema,
  catalogModifierCreateInputSchema,
  catalogModifierGroupCreateInputSchema,
  catalogModifierGroupUpdateInputSchema,
  catalogModifierUpdateInputSchema,
  catalogReadInputSchema,
  catalogReadOutputSchema,
  catalogReorderInputSchema,
  catalogVariantCreateInputSchema,
  catalogVariantRenameInputSchema,
  catalogVariantSetPriceInputSchema,
  catalogVersionOutputSchema,
  categoryOutputSchema,
  menuItemOutputSchema,
  modifierGroupOutputSchema,
  modifierOutputSchema,
  variantOutputSchema,
} from "./schemas.ts";

export const catalogContract = {
  listCategories: oc.input(z.void()).output(z.array(categoryOutputSchema)),
  listMenuItems: oc.input(z.void()).output(z.array(menuItemOutputSchema)),
  getMenuItem: oc
    .input(catalogEntityIdInputSchema)
    .output(menuItemOutputSchema.nullable()),
  listVariants: oc
    .input(catalogListVariantsInputSchema)
    .output(z.array(variantOutputSchema)),
  getVariant: oc
    .input(catalogEntityIdInputSchema)
    .output(variantOutputSchema.nullable()),

  createCategory: oc
    .input(catalogCategoryCreateInputSchema)
    .output(categoryOutputSchema.nullable()),
  renameCategory: oc
    .input(catalogCategoryRenameInputSchema)
    .output(categoryOutputSchema.nullable()),
  archiveCategory: oc
    .input(catalogEntityIdInputSchema)
    .output(categoryOutputSchema.nullable()),
  reactivateCategory: oc
    .input(catalogEntityIdInputSchema)
    .output(categoryOutputSchema.nullable()),
  reorderCategory: oc
    .input(catalogReorderInputSchema)
    .output(categoryOutputSchema.nullable()),

  createMenuItem: oc
    .input(catalogMenuItemCreateInputSchema)
    .output(menuItemOutputSchema.nullable()),
  renameMenuItem: oc
    .input(catalogMenuItemRenameInputSchema)
    .output(menuItemOutputSchema.nullable()),
  moveMenuItem: oc
    .input(catalogMenuItemMoveInputSchema)
    .output(menuItemOutputSchema.nullable()),
  setMenuItemPrice: oc
    .input(catalogMenuItemSetPriceInputSchema)
    .output(menuItemOutputSchema.nullable()),
  archiveMenuItem: oc
    .input(catalogEntityIdInputSchema)
    .output(menuItemOutputSchema.nullable()),
  reactivateMenuItem: oc
    .input(catalogEntityIdInputSchema)
    .output(menuItemOutputSchema.nullable()),
  reorderMenuItem: oc
    .input(catalogReorderInputSchema)
    .output(menuItemOutputSchema.nullable()),

  createVariant: oc
    .input(catalogVariantCreateInputSchema)
    .output(variantOutputSchema.nullable()),
  renameVariant: oc
    .input(catalogVariantRenameInputSchema)
    .output(variantOutputSchema.nullable()),
  setVariantPrice: oc
    .input(catalogVariantSetPriceInputSchema)
    .output(variantOutputSchema.nullable()),
  archiveVariant: oc
    .input(catalogEntityIdInputSchema)
    .output(variantOutputSchema.nullable()),
  reactivateVariant: oc
    .input(catalogEntityIdInputSchema)
    .output(variantOutputSchema.nullable()),
  reorderVariant: oc
    .input(catalogReorderInputSchema)
    .output(variantOutputSchema.nullable()),

  listModifierGroups: oc
    .input(z.void())
    .output(z.array(modifierGroupOutputSchema)),
  createModifierGroup: oc
    .input(catalogModifierGroupCreateInputSchema)
    .output(modifierGroupOutputSchema.nullable()),
  updateModifierGroup: oc
    .input(catalogModifierGroupUpdateInputSchema)
    .output(modifierGroupOutputSchema.nullable()),
  archiveModifierGroup: oc
    .input(catalogEntityIdInputSchema)
    .output(modifierGroupOutputSchema.nullable()),
  reactivateModifierGroup: oc
    .input(catalogEntityIdInputSchema)
    .output(modifierGroupOutputSchema.nullable()),
  reorderModifierGroup: oc
    .input(catalogReorderInputSchema)
    .output(modifierGroupOutputSchema.nullable()),

  listModifiers: oc
    .input(catalogListModifiersInputSchema)
    .output(z.array(modifierOutputSchema)),
  createModifier: oc
    .input(catalogModifierCreateInputSchema)
    .output(modifierOutputSchema.nullable()),
  updateModifier: oc
    .input(catalogModifierUpdateInputSchema)
    .output(modifierOutputSchema.nullable()),
  archiveModifier: oc
    .input(catalogEntityIdInputSchema)
    .output(modifierOutputSchema.nullable()),
  reactivateModifier: oc
    .input(catalogEntityIdInputSchema)
    .output(modifierOutputSchema.nullable()),
  reorderModifier: oc
    .input(catalogReorderInputSchema)
    .output(modifierOutputSchema.nullable()),

  linkModifierGroupToMenuItem: oc
    .input(catalogMenuItemModifierGroupInputSchema)
    .output(modifierGroupOutputSchema.nullable()),
  unlinkModifierGroupFromMenuItem: oc
    .input(catalogMenuItemModifierGroupInputSchema)
    .output(z.object({ ok: z.boolean() })),
  listLinkedModifierGroupsForMenuItem: oc
    .input(catalogListLinkedModifierGroupsForItemInputSchema)
    .output(z.array(modifierGroupOutputSchema)),

  read: oc.input(catalogReadInputSchema).output(catalogReadOutputSchema),
  version: oc.input(catalogReadInputSchema).output(catalogVersionOutputSchema),
};
