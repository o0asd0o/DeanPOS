# How Loyverse structures its catalog

- **Question:** where modifiers live and who creates them, how variants are modelled, and how
  per-store availability is toggled — read against `catalog`'s `## Approaches considered`.
- **Source:** *Loyverse POS System and Inventory Management — User guide*, last updated March 2024,
  314 pages. Supplied by the human as a local PDF. Page numbers below are the manual's own printed
  numbers, not PDF page indices.
- **Date:** 2026-08-04
- **Confidence:** high on mechanism, since every claim is a numbered instruction in the manual.
  Silent on anything the manual does not document — see `## What the manual does not say`.

## The short version

Loyverse ships **approach B for modifiers and the obvious version for variants.** Modifiers are a
tenant-level library on their own back-office screen and item editors only activate them. Variants
are per-item, typed again for every item that needs them. That split is the most useful thing in
this document, because it is the market leader in this exact segment doing both things at once, and
the seam between them is where DeanPOS's model is genuinely different rather than merely newer.

## 1. Modifiers — a tenant-level library, created on their own screen

`Items → Modifiers` in the Back Office. `+ Add modifier` opens a create form: a modifier name, then
`Option name` + `Price` pairs, `Add option` for more (pp. 65).

> "The modifier is a set of options that can be applied to the items." (p. 65)

Assignment is a second, separate step, and it runs from the item side:

> "Now you have to assign modifiers to each item. In the Back Office, go to the 'Item list' and open
> the necessary item to edit. Find the Modifiers section. **Activate** those modifiers which you
> want to apply to this item when selling." (p. 66)

**There is no create-a-modifier control inside the item editor.** The only creation surface is the
Modifiers screen. This is `## Approaches considered` B, shipped and in the field for years.

Two details that matter for DeanPOS:

- **Modifier options carry an absolute price only** — *"the price of the applied option will be
  added to the item's price"* (p. 65). No multiplier. DeanPOS's `Delta` with a `multiplier` kind is
  strictly richer, and record 003 already owns that choice.
- **Modifiers have no per-store scoping** anywhere in the manual. A modifier exists for the account.

## 2. Variants — per-item, and this is where Loyverse duplicates

Variants are created inside the item editor, in a `Variants` section, via `Add variants` (pp. 86–88):

- You type an **option name** on the left and its **values** on the right, Enter after each.
- Up to **3 options per item**; the system forms the cartesian product of all values.
- Hard cap of **200 combinations** per item.
- Price and cost are inherited from the parent item, SKU auto-generated; each combination can then
  be corrected individually, including **price per store** (p. 88).
- In CSV export, *"each combination of a variant in the export file is displayed as a separate item
  with its own SKU"*, tied together by a shared `Handle` (p. 90).

**The option name is not a shared object.** An account selling Whole/Half across fourteen ulam types
its `Size` option fourteen times, once per item, and nothing in the product links those fourteen to
each other or reports that they drifted apart.

That is precisely the failure mode the `catalog` PRD's Further Notes name and that `## Direction`
prohibition 8 exists to prevent — and Loyverse has it, in the half of the model it did not make a
library. It is worth being explicit that this is not a hypothetical: the segment leader ships the
duplication for variants while having already solved it for modifiers on the very same screen set.

**DeanPOS's shared `ModifierGroup` has no Loyverse equivalent.** Loyverse would model Whole/Half as a
per-item variant option, not as a shared group. So the comparison is not B-versus-not-B; it is
whether DeanPOS extends the library idea to the object Loyverse left per-item.

## 3. Per-store availability — a checkbox in the item editor, and nothing else

The control is `The item is available for sale`, a checkbox living inside the item editor (p. 16).
With multiple stores it becomes per-store, inside the item editor's `Stores` section:

> "You can manage the item parameters for each store. Open your item for editing, find the 'Stores'
> section, and change the price, in-stock quantity, and low-stock notification." (p. 241)

> "…if you have several stores, do not forget to add these stores in the Back Office and set the
> item's availability for each store." (p. 96)

CSV export confirms the shape — one column per store, named for the store:

> "you will have the following columns for each store: Available for sale, Price, In stock, and Low
> stock. Each of the 4 columns will have the store's name in brackets next to it. For example,
> `Available for sale [The Coffee]` and `Available for sale [Store 2]`." (p. 97)

The item list has a **store filter** that shows what is available in the selected store, but it is a
filter, not an editor (p. 241).

**There is no availability screen, no list-level toggle, and no bulk edit.** Turning one item off at
one store means opening that item's editor, finding the Stores section, unticking one box, and
saving. Loyverse's `Out of stock` is a *different mechanism* — it is inventory tracking, derived from
stock counts, surfaced in reports and stock alerts (pp. 221, 1719 ff.), not a manual sold-out switch.

**So Loyverse has no mid-service sold-out control at all.** A carinderia that runs out of adobo at
7pm either lets the till keep selling it or a manager opens the back office and edits the item.

## 4. Read against the three approaches

| | Loyverse | What it tells us |
| --- | --- | --- |
| **A — editable outline** | Not shipped. Item list is a flat table; editing is a full-page editor per item. | No support. The one thing A optimises for — the Tuesday price change without navigating — Loyverse does not offer either, and it is the incumbent's most-complained-about friction in this segment. Absence of evidence, not evidence of absence. |
| **B — options library** | **Shipped, for modifiers.** Own screen, own creation surface, item editors only activate. | Direct support, from the segment leader. B is not a novel bet; it is the shape a mature product in this market converged on. |
| **C — live read-model preview** | Not shipped. Nothing renders the till grid in the back office. | No support, and no counter-evidence. Loyverse's cascade is also far simpler — no required-one groups — so it has less to preview. |

## 5. Where DeanPOS is deliberately diverging, and it should stay diverged

Record 067 specifies a dedicated Availability screen with staged inline toggles and one page-level
Save. **Loyverse has nothing like it.** That is a gap DeanPOS is filling on purpose, not a convention
it is breaking, and this document is the evidence that the incumbent's answer is worse for the
carinderia case: an item-editor checkbox is unusable mid-service, which is exactly when a kitchen
runs out.

Two things follow, both worth carrying into the issues:

1. The Availability screen has no prior art to copy. 067 is doing original design, and its riskiest
   call — staged dirty cells with a page-level Save, the shape both 054 §Q3 and 040 refused in other
   contexts — carries more weight than it would if a shipped product had already proven it.
2. Loyverse's per-store availability being **item-level** while DeanPOS's is **variant-level** is a
   real scope difference. Turning off "Adobo" in Loyverse turns off the whole item; DeanPOS can turn
   off Half and leave Whole sellable. That is finer-grained and it is the right grain for the domain,
   but it multiplies the row count on the Availability screen by the average variant count — which
   sharpens 067 §4's `Mark all available` scoping and the pagination question rather than settling
   them.

## What the manual does not say

Recorded so nobody reads silence as a finding:

- Whether the Modifiers screen shows a **linked-to count** per modifier. The manual never shows that
  column, and approach B's strongest single feature is exactly that count being visible before an
  edit. **Unverified — needs a product screenshot or a trial account, not this document.**
- Whether modifiers can be archived, or only deleted, and what happens to historical tickets.
- Any per-store scoping for modifiers or discounts.
- Whether the 200-combination cap is enforced client-side or server-side.
- Any bulk or multi-select edit anywhere in the item list.

## Reversal note

Nothing here is a decision. It is evidence for the `### Chosen approach` slot in
`.scratch/catalog/PRD.md`, which is still unpicked as of this writing. If it is cited in a decision
record, cite the manual page, not this file.
