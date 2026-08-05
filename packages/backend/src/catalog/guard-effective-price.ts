// Called from three write paths: setVariantPrice, linkModifierGroup, updateModifier.
// Each computes the worst-case effective price and rejects if negative.
// "Worst case" for absolute Deltas: sum every negative absolute from every linked group.
// A multiplier can never alone make a price negative (multiplier min is 1 per-mille > 0).
// See .scratch/catalog/prd.md and .scratch/decisions/003-delta-composition.md.
import type { DatabaseInstance } from "../db/client.ts";

export class NegativeEffectivePriceError extends Error {
  constructor() {
    super("Linking this would allow a negative effective price");
  }
}

/**
 * Throws NegativeEffectivePriceError if, across all modifier groups currently
 * linked to variantId, any combination of absolute Deltas could drive the
 * effective price below zero.
 *
 * Worst-case selection: for each group, pick the most-negative absolute Modifier
 * (selecting the minimum absolute Delta across non-archived Modifiers).
 * Multipliers cannot produce a negative price on their own (min per-mille is 1).
 */
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
    // For a required-one group, exactly one Modifier is selected; pick the most negative.
    // For optional-one, the worst case is 0 (none selected) or the most negative if forced.
    // For many, worst case is the sum of all negative absolute Modifiers up to the maximum.
    // Simplified: for each group, the most a customer can subtract is the most-negative
    // active absolute Modifier value they could select.
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

  // Decision 003: contributions are summed against the base price.
  // Effective price = priceCentavos * 1000 (millicentavos) + sum of absolute deltas * 1000.
  // Since multipliers ≥ 0.001 never produce negative, we only check absolute sum.
  const effectiveCentavos = variant.price_centavos + worstCaseSumCentavos;

  if (effectiveCentavos < 0) {
    throw new NegativeEffectivePriceError();
  }
}
