// One guard, three callers (setVariantPrice, linkModifierGroup, updateModifier).
// See .scratch/decisions/003-delta-composition.md.
import type { DatabaseInstance } from "../db/client.ts";

export class NegativeEffectivePriceError extends Error {
  constructor() {
    super("Linking this would allow a negative effective price");
  }
}

/** Throws if worst-case absolute Deltas across linked groups drive effective price below zero. */
export async function guardEffectivePrice(db: DatabaseInstance, variantId: string): Promise<void> {
  const variant = await db
    .selectFrom("Variant")
    .select(["price_centavos"])
    .where("id", "=", variantId)
    .executeTakeFirst();

  if (!variant) return;

  // Collect worst-case absolute Delta from each linked group.
  // Only absolute Deltas can make a sum negative; multipliers are ≥ ×0.001.
  const groups = await db
    .selectFrom("VariantModifierGroup")
    .innerJoin("ModifierGroup", "ModifierGroup.id", "VariantModifierGroup.modifier_group_id")
    .where("VariantModifierGroup.variant_id", "=", variantId)
    .select(["ModifierGroup.id", "ModifierGroup.selection_rule"])
    .execute();

  let worstCaseSumCentavos = 0;

  for (const group of groups) {
    // Per group: worst-case subtraction a customer can select.
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
      // At most one selection; worst case is the most-negative single value.
      worstCaseSumCentavos += Math.min(...absNegatives);
    } else {
      // many: could select all negative ones (up to maximum, but conservative: sum all).
      worstCaseSumCentavos += absNegatives.reduce((s, v) => s + v, 0);
    }
  }

  // Decision 003: absolute deltas sum against base price.
  const effectiveCentavos = variant.price_centavos + worstCaseSumCentavos;

  if (effectiveCentavos < 0) {
    throw new NegativeEffectivePriceError();
  }
}
