# 075: MenuItem is sellable without variants and links modifier groups directly

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-07
- **Asked by:** interactive — user confirmed during catalog options work

## The question

The PRD locked the hierarchy as `MenuItem → Variant → ModifierGroup` and said "a MenuItem with zero non-archived Variants is not sellable." MenuItem now carries its own `price_centavos` (migration `20260805120000_menu_item_price`). Should a MenuItem be sellable on that price alone, and should modifier groups be linkable directly to it?

## What was decided, and why

**Yes.** MenuItem is sellable without any Variant. Modifier groups link at either level:

- `MenuItemModifierGroup` — applies to the item regardless of which variant is chosen
- `VariantModifierGroup` — overrides or augments at the variant level (unchanged)

**Why**: `price_centavos` already lives on `MenuItem`. The only reason variants were required was that price was variant-only (ADR-0005). That constraint no longer holds. Requiring a "Regular" variant for every single-price item added friction with no model benefit.

## Shape

New join table `MenuItemModifierGroup` (same structure as `VariantModifierGroup`, `menu_item_id` in place of `variant_id`). New API routes: `linkModifierGroupToMenuItem`, `unlinkModifierGroupFromMenuItem`, `listLinkedModifierGroupsForMenuItem`. `guardEffectivePrice` extended to accept a `menuItemId` path. The `linked_to_count` on `ModifierGroup` counts both item and variant links against non-archived rows.

Read model: `catalogReadMenuItemSchema` gains `modifierGroups` alongside `variants`. The sellable query and version query drop the `EXISTS (Variant)` gate.

## What this changes from the PRD

- "A MenuItem with zero non-archived Variants is not sellable" → removed.
- "Price lives only on Variant" → relaxed; price lives on both.
- The "Add a variant" nudge in the list card is no longer a hard requirement signal.

## How to turn it back

Re-add the `EXISTS (Variant)` sub-select to `list-sellable-menu-items.query.ts` and `catalog-version.query.ts`. Drop `MenuItemModifierGroup` table. No data loss to existing linked variants.
