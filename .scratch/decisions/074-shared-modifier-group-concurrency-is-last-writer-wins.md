# 074: Shared modifier group concurrency is last-writer-wins

- **Status:** decided
- **Stakes:** low
- **Date:** 2026-08-06
- **Asked by:** `.scratch/catalog/issues/04-linking-groups-to-variants-and-the-negative-price-guard.md` (AC #9, PRD `## Scenarios` row 2)

## The question

Two managers editing the same shared ModifierGroup from two browsers — what happens?

## What was decided, and why

**Last-writer-wins, following record [067](067-the-availability-screen-stages-toggles-and-saves-once.md) §3's precedent for availability.** The human chose this.

A ModifierGroup is a small object edited rarely. The linked-to count already warns editors they're touching shared data. Optimistic concurrency (a version check rejecting stale writes) is the stronger answer but adds complexity for a collision that is unlikely in a carinderia with one or two managers.

## How to turn it back

Add a `version` column to `ModifierGroup`, increment on write, reject on mismatch. One migration, one column, one check in the handler. No data loss.

## What would make this decision wrong

A tenant with multiple managers frequently editing the same group and losing each other's changes. The linked-to count makes the shared nature visible, so the trigger is complaints despite that visibility.
