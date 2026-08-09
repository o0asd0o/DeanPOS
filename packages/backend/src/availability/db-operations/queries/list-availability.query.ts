import type { DatabaseInstance } from "../../../db/client.ts";
import type { PageEnvelope } from "../../../common/pagination.ts";

export type AvailabilityListInput = {
  storeId: string;
  page: number;
  perPage: number;
  search?: string;
  sort?: { key: "name" | "price" | "available" | "menuItem"; direction: "asc" | "desc" };
};

export type AvailabilityRow = {
  kind: "variant" | "menuItem";
  id: string;
  name: string;
  menuItemName: string | null;
  priceCentavos: number;
  available: boolean;
};

export type AvailabilityListOutput = PageEnvelope<AvailabilityRow> & {
  unavailableInScope: { kind: "variant" | "menuItem"; id: string }[];
};

export const listAvailability = async (
  db: DatabaseInstance,
  input: AvailabilityListInput,
): Promise<AvailabilityListOutput> => {
  const menuItems = db
    .selectFrom("MenuItem as m")
    .innerJoin("Category as c", (join) =>
      join.onRef("c.id", "=", "m.category_id").onRef("c.tenant_id", "=", "m.tenant_id"),
    )
    .select(({ eb }) => [
      eb.val("menuItem").$castTo<"variant" | "menuItem">().as("kind"),
      "m.id as id",
      "m.name as name",
      eb.val(null).$castTo<string | null>().as("menuItemName"),
      "m.price_centavos as priceCentavos",
      eb
        .not(
          eb.exists(
            db
              .selectFrom("MenuItemUnavailability as u")
              .select("u.id")
              .where("u.menu_item_id", "=", eb.ref("m.id"))
              .where("u.store_id", "=", input.storeId),
          ),
        )
        .as("available"),
    ])
    .where("m.archived_at", "is", null)
    .where("c.archived_at", "is", null);

  const variants = db
    .selectFrom("Variant as v")
    .innerJoin("MenuItem as m", (join) =>
      join.onRef("m.id", "=", "v.menu_item_id").onRef("m.tenant_id", "=", "v.tenant_id"),
    )
    .innerJoin("Category as c", (join) =>
      join.onRef("c.id", "=", "m.category_id").onRef("c.tenant_id", "=", "m.tenant_id"),
    )
    .select(({ eb }) => [
      eb.val("variant").$castTo<"variant" | "menuItem">().as("kind"),
      "v.id as id",
      "v.name as name",
      eb.ref("m.name").$castTo<string | null>().as("menuItemName"),
      "v.price_centavos as priceCentavos",
      eb
        .not(
          eb.exists(
            db
              .selectFrom("VariantUnavailability as u")
              .select("u.id")
              .where("u.variant_id", "=", eb.ref("v.id"))
              .where("u.store_id", "=", input.storeId),
          ),
        )
        .as("available"),
    ])
    .where("v.archived_at", "is", null)
    .where("m.archived_at", "is", null)
    .where("c.archived_at", "is", null);

  const combined = menuItems.unionAll(variants).$castTo<AvailabilityRow>().as("availability");
  let query = db.selectFrom(combined).selectAll();
  if (input.search) {
    const search = `%${input.search.replace(/[\\%_]/g, "\\$&")}%`;
    query = query.where((eb) =>
      eb.or([
        eb("availability.name", "ilike", search),
        eb("availability.menuItemName", "ilike", search),
      ]),
    );
  }

  const sortKey =
    input.sort?.key === "price"
      ? "availability.priceCentavos"
      : input.sort?.key === "available"
        ? "availability.available"
        : input.sort?.key === "menuItem"
          ? "availability.menuItemName"
          : "availability.name";
  const direction = input.sort?.direction ?? "asc";
  const result = await query
    .orderBy(sortKey, direction)
    .orderBy("availability.id", "asc")
    .limit(input.perPage + 1)
    .offset((input.page - 1) * input.perPage)
    .execute();

  let countQuery = db.selectFrom(combined).select(({ fn }) => fn.countAll<number>().as("count"));
  if (input.search) {
    const search = `%${input.search.replace(/[\\%_]/g, "\\$&")}%`;
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb("availability.name", "ilike", search),
        eb("availability.menuItemName", "ilike", search),
      ]),
    );
  }
  const count = Number((await countQuery.executeTakeFirstOrThrow()).count);

  const unavailable = await db
    .selectFrom("VariantUnavailability")
    .select(({ eb }) => [
      eb.val("variant").$castTo<"variant" | "menuItem">().as("kind"),
      "variant_id as id",
    ])
    .where("store_id", "=", input.storeId)
    .unionAll(
      db
        .selectFrom("MenuItemUnavailability")
        .select(({ eb }) => [
          eb.val("menuItem").$castTo<"variant" | "menuItem">().as("kind"),
          "menu_item_id as id",
        ])
        .where("store_id", "=", input.storeId),
    )
    .execute();

  return {
    items: result.slice(0, input.perPage),
    count,
    page: input.page,
    perPage: input.perPage,
    hasNextPage: result.length > input.perPage,
    hasPrevPage: input.page > 1,
    unavailableInScope: unavailable,
  };
};
