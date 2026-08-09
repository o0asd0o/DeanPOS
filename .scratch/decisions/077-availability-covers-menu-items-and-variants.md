# 077: Availability covers MenuItems and Variants

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-09
- **Asked by:** the human, Issue 07 implementation
- **Relates to:** [067](067-availability-toggles-stage-a-draft.md), [071](071-variant-unavailability-per-store.md), [075](075-menu-items-may-have-zero-variants.md)

## The question

Issue 07 must represent a single-price MenuItem while preserving per-Store negative availability.

## What I chose and why

Availability uses two explicit tables: `VariantUnavailability` and `MenuItemUnavailability`. A row means sold out at that Store; absence means available. MenuItems and Variants toggle independently; there is no cross-level derivation. A nullable-target table was rejected because it weakens constraints and hides the domain distinction.

`availability.list` is server-paginated. Paging and searching within the route do not trigger the leave guard; Store changes and leaving the route do. The empty state reads `Availability follows the catalog. Add a menu item, and it appears here.`

The route and procedures require `admin`; Store existence plus `canAccessStore` authorize the target, and wrong-tenant probes cover both procedures.

## How to turn it back

Drop both models, contracts, handlers, and read-model fields together before dependent read-model work ships.

## What should make you reverse this

Reverse only if independent item/variant controls create a reported sellability contradiction or server pagination materially harms the save workflow.

## Evidence

Record 075 permits MenuItems with zero Variants. Record 071's negative-join reasoning remains valid for both tables.
