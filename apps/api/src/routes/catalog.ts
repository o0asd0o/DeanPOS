import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as archiveCategoryHandler } from "backend/src/catalog/handlers/archive-category.ts";
import { handler as archiveMenuItemHandler } from "backend/src/catalog/handlers/archive-menu-item.ts";
import { handler as archiveModifierHandler } from "backend/src/modifier/handlers/archive-modifier.ts";
import { handler as archiveModifierGroupHandler } from "backend/src/modifier-group/handlers/archive-modifier-group.ts";
import { handler as archiveAddOnHandler } from "backend/src/add-on/handlers/archive-add-on.ts";
import { handler as archiveVariantHandler } from "backend/src/variant/handlers/archive-variant.ts";
import { handler as catalogVersionHandler } from "backend/src/catalog/handlers/catalog-version.ts";
import { handler as createCategoryHandler } from "backend/src/catalog/handlers/create-category.ts";
import { handler as createMenuItemHandler } from "backend/src/catalog/handlers/create-menu-item.ts";
import { handler as createModifierHandler } from "backend/src/modifier/handlers/create-modifier.ts";
import { handler as createModifierGroupHandler } from "backend/src/modifier-group/handlers/create-modifier-group.ts";
import { handler as createAddOnHandler } from "backend/src/add-on/handlers/create-add-on.ts";
import { handler as createVariantHandler } from "backend/src/variant/handlers/create-variant.ts";
import { handler as getMenuItemHandler } from "backend/src/catalog/handlers/get-menu-item.ts";
import { handler as getVariantHandler } from "backend/src/variant/handlers/get-variant.ts";
import { handler as listCategoriesHandler } from "backend/src/catalog/handlers/list-categories.ts";
import { handler as listMenuItemsHandler } from "backend/src/catalog/handlers/list-menu-items.ts";
import { handler as listModifierGroupsHandler } from "backend/src/modifier-group/handlers/list-modifier-groups.ts";
import { handler as listAddOnsHandler } from "backend/src/add-on/handlers/list-add-ons.ts";
import { handler as listModifiersHandler } from "backend/src/modifier/handlers/list-modifiers.ts";
import { handler as listVariantsHandler } from "backend/src/variant/handlers/list-variants.ts";
import { handler as moveMenuItemHandler } from "backend/src/catalog/handlers/move-menu-item.ts";
import { handler as setMenuItemPriceHandler } from "backend/src/catalog/handlers/set-menu-item-price.ts";
import { handler as reactivateCategoryHandler } from "backend/src/catalog/handlers/reactivate-category.ts";
import { handler as reactivateMenuItemHandler } from "backend/src/catalog/handlers/reactivate-menu-item.ts";
import { handler as reactivateModifierHandler } from "backend/src/modifier/handlers/reactivate-modifier.ts";
import { handler as reactivateModifierGroupHandler } from "backend/src/modifier-group/handlers/reactivate-modifier-group.ts";
import { handler as reactivateAddOnHandler } from "backend/src/add-on/handlers/reactivate-add-on.ts";
import { handler as reactivateVariantHandler } from "backend/src/variant/handlers/reactivate-variant.ts";
import { handler as readCatalogHandler } from "backend/src/catalog/handlers/read-catalog.ts";
import { handler as renameCategoryHandler } from "backend/src/catalog/handlers/rename-category.ts";
import { handler as renameMenuItemHandler } from "backend/src/catalog/handlers/rename-menu-item.ts";
import { handler as renameVariantHandler } from "backend/src/variant/handlers/rename-variant.ts";
import { handler as reorderCategoryHandler } from "backend/src/catalog/handlers/reorder-category.ts";
import { handler as reorderMenuItemHandler } from "backend/src/catalog/handlers/reorder-menu-item.ts";
import { handler as reorderModifierHandler } from "backend/src/modifier/handlers/reorder-modifier.ts";
import { handler as reorderModifierGroupHandler } from "backend/src/modifier-group/handlers/reorder-modifier-group.ts";
import { handler as reorderAddOnHandler } from "backend/src/add-on/handlers/reorder-add-on.ts";
import { handler as reorderVariantHandler } from "backend/src/variant/handlers/reorder-variant.ts";
import { handler as setVariantPriceHandler } from "backend/src/variant/handlers/set-variant-price.ts";
import { handler as updateModifierHandler } from "backend/src/modifier/handlers/update-modifier.ts";
import { handler as updateModifierGroupHandler } from "backend/src/modifier-group/handlers/update-modifier-group.ts";
import { handler as updateAddOnHandler } from "backend/src/add-on/handlers/update-add-on.ts";
import { handler as linkModifierGroupToItemHandler } from "backend/src/catalog/handlers/link-modifier-group-to-item.ts";
import { handler as unlinkModifierGroupFromItemHandler } from "backend/src/catalog/handlers/unlink-modifier-group-from-item.ts";
import { handler as listLinkedModifierGroupsForItemHandler } from "backend/src/catalog/handlers/list-linked-modifier-groups-for-item.ts";
import { handler as linkAddOnToItemHandler } from "backend/src/catalog/handlers/link-add-on-to-menu-item.ts";
import { handler as unlinkAddOnFromItemHandler } from "backend/src/catalog/handlers/unlink-add-on-from-menu-item.ts";
import { handler as listLinkedAddOnsForItemHandler } from "backend/src/catalog/handlers/list-linked-add-ons-for-menu-item.ts";
import { contract } from "contract/src/index.ts";

// Only transport-aware code for `catalog.*` (ADR-0008 rule 5).
const os = implement(contract).$context<Ctx>();

export const catalogListCategoriesRoute = os.catalog.listCategories.handler(({ context }) =>
  listCategoriesHandler({ ctx: context, input: undefined }),
);
export const catalogListMenuItemsRoute = os.catalog.listMenuItems.handler(({ context, input }) =>
  listMenuItemsHandler({ ctx: context, input }),
);
export const catalogGetMenuItemRoute = os.catalog.getMenuItem.handler(({ context, input }) =>
  getMenuItemHandler({ ctx: context, input }),
);
export const catalogListVariantsRoute = os.catalog.listVariants.handler(({ context, input }) =>
  listVariantsHandler({ ctx: context, input }),
);
export const catalogGetVariantRoute = os.catalog.getVariant.handler(({ context, input }) =>
  getVariantHandler({ ctx: context, input }),
);
export const catalogCreateCategoryRoute = os.catalog.createCategory.handler(({ context, input }) =>
  createCategoryHandler({ ctx: context, input }),
);
export const catalogRenameCategoryRoute = os.catalog.renameCategory.handler(({ context, input }) =>
  renameCategoryHandler({ ctx: context, input }),
);
export const catalogArchiveCategoryRoute = os.catalog.archiveCategory.handler(
  ({ context, input }) => archiveCategoryHandler({ ctx: context, input }),
);
export const catalogReactivateCategoryRoute = os.catalog.reactivateCategory.handler(
  ({ context, input }) => reactivateCategoryHandler({ ctx: context, input }),
);
export const catalogReorderCategoryRoute = os.catalog.reorderCategory.handler(
  ({ context, input }) => reorderCategoryHandler({ ctx: context, input }),
);
export const catalogCreateMenuItemRoute = os.catalog.createMenuItem.handler(({ context, input }) =>
  createMenuItemHandler({ ctx: context, input }),
);
export const catalogRenameMenuItemRoute = os.catalog.renameMenuItem.handler(({ context, input }) =>
  renameMenuItemHandler({ ctx: context, input }),
);
export const catalogMoveMenuItemRoute = os.catalog.moveMenuItem.handler(({ context, input }) =>
  moveMenuItemHandler({ ctx: context, input }),
);
export const catalogSetMenuItemPriceRoute = os.catalog.setMenuItemPrice.handler(
  ({ context, input }) => setMenuItemPriceHandler({ ctx: context, input }),
);
export const catalogArchiveMenuItemRoute = os.catalog.archiveMenuItem.handler(
  ({ context, input }) => archiveMenuItemHandler({ ctx: context, input }),
);
export const catalogReactivateMenuItemRoute = os.catalog.reactivateMenuItem.handler(
  ({ context, input }) => reactivateMenuItemHandler({ ctx: context, input }),
);
export const catalogReorderMenuItemRoute = os.catalog.reorderMenuItem.handler(
  ({ context, input }) => reorderMenuItemHandler({ ctx: context, input }),
);
export const catalogCreateVariantRoute = os.catalog.createVariant.handler(({ context, input }) =>
  createVariantHandler({ ctx: context, input }),
);
export const catalogRenameVariantRoute = os.catalog.renameVariant.handler(({ context, input }) =>
  renameVariantHandler({ ctx: context, input }),
);
export const catalogSetVariantPriceRoute = os.catalog.setVariantPrice.handler(
  ({ context, input }) => setVariantPriceHandler({ ctx: context, input }),
);
export const catalogArchiveVariantRoute = os.catalog.archiveVariant.handler(({ context, input }) =>
  archiveVariantHandler({ ctx: context, input }),
);
export const catalogReactivateVariantRoute = os.catalog.reactivateVariant.handler(
  ({ context, input }) => reactivateVariantHandler({ ctx: context, input }),
);
export const catalogReorderVariantRoute = os.catalog.reorderVariant.handler(({ context, input }) =>
  reorderVariantHandler({ ctx: context, input }),
);
export const catalogListModifierGroupsRoute = os.catalog.listModifierGroups.handler(({ context }) =>
  listModifierGroupsHandler({ ctx: context, input: undefined }),
);
export const catalogCreateModifierGroupRoute = os.catalog.createModifierGroup.handler(
  ({ context, input }) => createModifierGroupHandler({ ctx: context, input }),
);
export const catalogUpdateModifierGroupRoute = os.catalog.updateModifierGroup.handler(
  ({ context, input }) => updateModifierGroupHandler({ ctx: context, input }),
);
export const catalogArchiveModifierGroupRoute = os.catalog.archiveModifierGroup.handler(
  ({ context, input }) => archiveModifierGroupHandler({ ctx: context, input }),
);
export const catalogReactivateModifierGroupRoute = os.catalog.reactivateModifierGroup.handler(
  ({ context, input }) => reactivateModifierGroupHandler({ ctx: context, input }),
);
export const catalogReorderModifierGroupRoute = os.catalog.reorderModifierGroup.handler(
  ({ context, input }) => reorderModifierGroupHandler({ ctx: context, input }),
);
export const catalogListModifiersRoute = os.catalog.listModifiers.handler(({ context, input }) =>
  listModifiersHandler({ ctx: context, input }),
);
export const catalogCreateModifierRoute = os.catalog.createModifier.handler(({ context, input }) =>
  createModifierHandler({ ctx: context, input }),
);
export const catalogUpdateModifierRoute = os.catalog.updateModifier.handler(({ context, input }) =>
  updateModifierHandler({ ctx: context, input }),
);
export const catalogArchiveModifierRoute = os.catalog.archiveModifier.handler(
  ({ context, input }) => archiveModifierHandler({ ctx: context, input }),
);
export const catalogReactivateModifierRoute = os.catalog.reactivateModifier.handler(
  ({ context, input }) => reactivateModifierHandler({ ctx: context, input }),
);
export const catalogReorderModifierRoute = os.catalog.reorderModifier.handler(
  ({ context, input }) => reorderModifierHandler({ ctx: context, input }),
);
export const catalogLinkModifierGroupToMenuItemRoute =
  os.catalog.linkModifierGroupToMenuItem.handler(({ context, input }) =>
    linkModifierGroupToItemHandler({ ctx: context, input }),
  );
export const catalogUnlinkModifierGroupFromMenuItemRoute =
  os.catalog.unlinkModifierGroupFromMenuItem.handler(({ context, input }) =>
    unlinkModifierGroupFromItemHandler({ ctx: context, input }),
  );
export const catalogListLinkedModifierGroupsForMenuItemRoute =
  os.catalog.listLinkedModifierGroupsForMenuItem.handler(({ context, input }) =>
    listLinkedModifierGroupsForItemHandler({ ctx: context, input }),
  );
export const catalogListAddOnsRoute = os.catalog.listAddOns.handler(({ context }) =>
  listAddOnsHandler({ ctx: context, input: undefined }),
);
export const catalogCreateAddOnRoute = os.catalog.createAddOn.handler(({ context, input }) =>
  createAddOnHandler({ ctx: context, input }),
);
export const catalogUpdateAddOnRoute = os.catalog.updateAddOn.handler(({ context, input }) =>
  updateAddOnHandler({ ctx: context, input }),
);
export const catalogArchiveAddOnRoute = os.catalog.archiveAddOn.handler(({ context, input }) =>
  archiveAddOnHandler({ ctx: context, input }),
);
export const catalogReactivateAddOnRoute = os.catalog.reactivateAddOn.handler(
  ({ context, input }) => reactivateAddOnHandler({ ctx: context, input }),
);
export const catalogReorderAddOnRoute = os.catalog.reorderAddOn.handler(({ context, input }) =>
  reorderAddOnHandler({ ctx: context, input }),
);
export const catalogLinkAddOnToMenuItemRoute = os.catalog.linkAddOnToMenuItem.handler(
  ({ context, input }) => linkAddOnToItemHandler({ ctx: context, input }),
);
export const catalogUnlinkAddOnFromMenuItemRoute = os.catalog.unlinkAddOnFromMenuItem.handler(
  ({ context, input }) => unlinkAddOnFromItemHandler({ ctx: context, input }),
);
export const catalogListLinkedAddOnsForMenuItemRoute =
  os.catalog.listLinkedAddOnsForMenuItem.handler(({ context, input }) =>
    listLinkedAddOnsForItemHandler({ ctx: context, input }),
  );
export const catalogReadRoute = os.catalog.read.handler(({ context, input }) =>
  readCatalogHandler({ ctx: context, input }),
);
export const catalogVersionRoute = os.catalog.version.handler(({ context, input }) =>
  catalogVersionHandler({ ctx: context, input }),
);
