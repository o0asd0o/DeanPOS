// Guards: see .scratch/decisions/003-delta-composition.md and decision 075/076.
// guardEffectivePrice: variant price change — checks variant price vs item's groups.
// guardEffectivePriceForItem: item link / modifier delta change — checks item + all variants.
import type { DatabaseInstance } from "../db/client.ts";

export class NegativeEffectivePriceError extends Error {
  constructor() {
    super("Linking this would allow a negative effective price");
  }
}

async function worstCaseDelta(
  db: DatabaseInstance,
  groups: { id: string; selection_rule: string }[],
  menuItemId: string,
): Promise<number> {
  let sum = 0;
  for (const group of groups) {
    const modifiers = await db
      .selectFrom("Modifier")
      .select(["delta_kind", "delta_value"])
      .where("group_id", "=", group.id)
      .where("archived_at", "is", null)
      .execute();

    const absNegatives = modifiers
      .filter((m) => m.delta_kind === "absolute" && m.delta_value < 0)
      .map((m) => m.delta_value);

    if (absNegatives.length === 0) continue;

    if (group.selection_rule === "required-one" || group.selection_rule === "optional-one") {
      sum += Math.min(...absNegatives);
    } else {
      sum += absNegatives.reduce((s, v) => s + v, 0);
    }
  }
  const addOns = await db
    .selectFrom("MenuItemAddOn")
    .innerJoin("AddOn", "AddOn.id", "MenuItemAddOn.add_on_id")
    .select(["AddOn.delta_kind", "AddOn.delta_value"])
    .where("MenuItemAddOn.menu_item_id", "=", menuItemId)
    .where("AddOn.archived_at", "is", null)
    .execute();
  sum += addOns
    .filter((addOn) => addOn.delta_kind === "absolute" && addOn.delta_value < 0)
    .reduce((total, addOn) => total + addOn.delta_value, 0);
  return sum;
}

async function itemGroups(db: DatabaseInstance, menuItemId: string) {
  return db
    .selectFrom("MenuItemModifierGroup")
    .innerJoin("ModifierGroup", "ModifierGroup.id", "MenuItemModifierGroup.modifier_group_id")
    .where("MenuItemModifierGroup.menu_item_id", "=", menuItemId)
    .select(["ModifierGroup.id", "ModifierGroup.selection_rule"])
    .execute();
}

/** Variant price change: throws if variant price + item's linked groups worst delta < 0. */
export async function guardEffectivePrice(db: DatabaseInstance, variantId: string): Promise<void> {
  const variant = await db
    .selectFrom("Variant")
    .select(["price_centavos", "menu_item_id"])
    .where("id", "=", variantId)
    .executeTakeFirst();

  if (!variant) return;

  const groups = await itemGroups(db, variant.menu_item_id);
  const delta = await worstCaseDelta(db, groups, variant.menu_item_id);
  if (variant.price_centavos + delta < 0) throw new NegativeEffectivePriceError();
}

/** Item link or modifier delta change: throws if item or any active variant price + delta < 0. */
export async function guardEffectivePriceForItem(
  db: DatabaseInstance,
  menuItemId: string,
): Promise<void> {
  const item = await db
    .selectFrom("MenuItem")
    .select(["price_centavos"])
    .where("id", "=", menuItemId)
    .executeTakeFirst();

  if (!item) return;

  const groups = await itemGroups(db, menuItemId);
  const delta = await worstCaseDelta(db, groups, menuItemId);
  if (item.price_centavos + delta < 0) throw new NegativeEffectivePriceError();

  const variants = await db
    .selectFrom("Variant")
    .select(["price_centavos"])
    .where("menu_item_id", "=", menuItemId)
    .where("archived_at", "is", null)
    .execute();

  for (const v of variants) {
    if (v.price_centavos + delta < 0) throw new NegativeEffectivePriceError();
  }
}
