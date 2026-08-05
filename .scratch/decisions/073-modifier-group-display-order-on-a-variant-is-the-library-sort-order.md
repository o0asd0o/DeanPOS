# 073: Modifier group display order on a Variant is the library's own sort order

- **Status:** decided
- **Stakes:** low
- **Date:** 2026-08-06
- **Asked by:** `.scratch/catalog/issues/04-linking-groups-to-variants-and-the-negative-price-guard.md` (AC #7, PRD `## Scenarios` row 15)

## The question

When a Variant has two or more ModifierGroups linked to it, what determines the order they appear in — on the terminal, in the Variant editor, and in the read model?

PRD row 15 flags this as "decider-grade" and AC #7 requires it to be deterministic and stored.

## What was decided, and why

**The library's existing `ModifierGroup.sort_order` determines display order. No extra column on the link table.**

Decision 003 makes the arithmetic order-independent: every Delta is computed against the base price and contributions are summed, so no reordering can change the total. The ×0.5 × ×0.5 scenario row 15 names is blocked entirely by 003's one-multiplier guard. For absolute Deltas, order is irrelevant (addition is commutative).

That leaves display order as the only question. Three options were considered:

1. **Per-link `sort_position`** — manager controls order per Variant. Extra column, extra UI, unlikely anyone needs "Size before Spice" on one dish but the reverse on another.
2. **Library `sort_order`** — reuse `ModifierGroup.sort_order`. Every Variant shows groups in the same order. No extra column. **Chosen.**
3. **No stored order** — alphabetical or creation date. Risk of non-determinism across queries.

Option 2 chosen by the human: simpler, one fewer column, and the library order is already manager-controlled via the Options screen's reordering.

## How to turn it back

Add a `sort_position` column to the `VariantModifierGroup` link table and an `ORDER BY` clause. One migration, one column, one UI control. No data loss — backfill from the library order.

## What would make this decision wrong

A tenant genuinely needing different group orders on different Variants — e.g. "Size first on soups, Spice first on grills." The trigger to reopen is a real menu that wants it, not the hypothetical.
