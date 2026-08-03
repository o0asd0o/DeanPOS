# 049 — The Store and User editors open in a detached, non-modal sheet

- **Status:** accepted
- **Date:** 2026-08-03
- **Stakes:** medium — changes a shipped screen shape and a dialog's modality
- **Asked by:** the human, directly
- **Decided by:** the human; this record states what moved and what had to hold
- **Relates to:** [038](038-the-store-list.md), [039](039-the-table-labels-editor.md), [040](040-the-store-editor.md), [044](044-the-users-list.md), [045](045-the-user-editor.md)

## What changed

`StoreEditor` and `UserEditor` were `Card`s rendered *below* the list. They now
open in a right-side `Sheet` that is inset from every edge — the card inside is
the visible panel, so the page shows around it. Row actions gained icons beside
their words and a light border (`variant="outline"`).

## Non-modal, on purpose

Records 038/039 fixed a behaviour the sheet nearly broke: **switching the editor
straight from one row to another**, with the second row's data, no stale draft
carried over. A modal sheet makes the list behind it `aria-hidden` and
unclickable, so that switch becomes impossible — the test for it failed
immediately, which is what the test is for.

The sheet is therefore `modal={false}` and renders **no overlay**. The list
stays live behind it, one row's editor swaps straight for another's, and the
`key` on the editor still resets the form per row.

## The heading is the sheet's label

Radix needs an accessible name on a dialog. A separate `sr-only` title next to
the editor's own `CardTitle` produced two headings with the same name and made
`getByRole("heading", { name: "New store" })` ambiguous. Instead the editor's
existing heading **is** the title: `<SheetTitle asChild><CardTitle …>`. One
heading, one accessible name, no duplicate.

One test moved with this: the Users reset-password case asserted "no dialog
remains", which is now false by construction because the editor *is* a dialog.
It names the dialog it means.

## Reversal

Unwrap the two `<Sheet>` blocks in `Stores.tsx` and `Users.tsx` and drop the
`SheetTitle asChild` in the editors. The `detached-panel` utility and
`SheetContent`'s `withOverlay` prop are independently useful and can stay.
