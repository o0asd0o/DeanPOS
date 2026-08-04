import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as archiveCategoryHandler } from "backend/src/catalog/handlers/archive-category.ts";
import { handler as archiveMenuItemHandler } from "backend/src/catalog/handlers/archive-menu-item.ts";
import { handler as archiveVariantHandler } from "backend/src/catalog/handlers/archive-variant.ts";
import { handler as catalogVersionHandler } from "backend/src/catalog/handlers/catalog-version.ts";
import { handler as createCategoryHandler } from "backend/src/catalog/handlers/create-category.ts";
import { handler as createMenuItemHandler } from "backend/src/catalog/handlers/create-menu-item.ts";
import { handler as createVariantHandler } from "backend/src/catalog/handlers/create-variant.ts";
import { handler as getMenuItemHandler } from "backend/src/catalog/handlers/get-menu-item.ts";
import { handler as getVariantHandler } from "backend/src/catalog/handlers/get-variant.ts";
import { handler as listCategoriesHandler } from "backend/src/catalog/handlers/list-categories.ts";
import { handler as listMenuItemsHandler } from "backend/src/catalog/handlers/list-menu-items.ts";
import { handler as listVariantsHandler } from "backend/src/catalog/handlers/list-variants.ts";
import { handler as moveMenuItemHandler } from "backend/src/catalog/handlers/move-menu-item.ts";
import { handler as reactivateCategoryHandler } from "backend/src/catalog/handlers/reactivate-category.ts";
import { handler as reactivateMenuItemHandler } from "backend/src/catalog/handlers/reactivate-menu-item.ts";
import { handler as reactivateVariantHandler } from "backend/src/catalog/handlers/reactivate-variant.ts";
import { handler as readCatalogHandler } from "backend/src/catalog/handlers/read-catalog.ts";
import { handler as renameCategoryHandler } from "backend/src/catalog/handlers/rename-category.ts";
import { handler as renameMenuItemHandler } from "backend/src/catalog/handlers/rename-menu-item.ts";
import { handler as renameVariantHandler } from "backend/src/catalog/handlers/rename-variant.ts";
import { handler as reorderCategoryHandler } from "backend/src/catalog/handlers/reorder-category.ts";
import { handler as reorderMenuItemHandler } from "backend/src/catalog/handlers/reorder-menu-item.ts";
import { handler as reorderVariantHandler } from "backend/src/catalog/handlers/reorder-variant.ts";
import { handler as setVariantPriceHandler } from "backend/src/catalog/handlers/set-variant-price.ts";
import { contract } from "contract/src/index.ts";

// Only transport-aware code for `catalog.*` (ADR-0008 rule 5).
const os = implement(contract).$context<Ctx>();

export const catalogListCategoriesRoute = os.catalog.listCategories.handler(({ context }) =>
  listCategoriesHandler({ ctx: context, input: undefined }),
);
export const catalogListMenuItemsRoute = os.catalog.listMenuItems.handler(({ context }) =>
  listMenuItemsHandler({ ctx: context, input: undefined }),
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
export const catalogArchiveVariantRoute = os.catalog.archiveVariant.handler(
  ({ context, input }) => archiveVariantHandler({ ctx: context, input }),
);
export const catalogReactivateVariantRoute = os.catalog.reactivateVariant.handler(
  ({ context, input }) => reactivateVariantHandler({ ctx: context, input }),
);
export const catalogReorderVariantRoute = os.catalog.reorderVariant.handler(
  ({ context, input }) => reorderVariantHandler({ ctx: context, input }),
);
export const catalogReadRoute = os.catalog.read.handler(({ context, input }) =>
  readCatalogHandler({ ctx: context, input }),
);
export const catalogVersionRoute = os.catalog.version.handler(({ context, input }) =>
  catalogVersionHandler({ ctx: context, input }),
);
