# 050 — The editor sheet is header / body / footer, and the form wraps all three

- **Status:** accepted
- **Date:** 2026-08-03
- **Stakes:** low — a shell for shipped screens, no behaviour of its own
- **Asked by:** the human, with a reference
- **Decided by:** the human; this record states the parts that were not obvious
- **Relates to:** [045](045-the-user-editor.md), [049](049-the-editor-is-a-detached-sheet.md)

## The shape

`SheetForm` (apps/backoffice/src/components) renders three parts:

1. **Header** — the sheet's title and its close control, `border-b`.
2. **Body** — the only scrolling region, holding the fields.
3. **Footer** — the action row, `border-t`, fixed at the bottom.

The panel fills the sheet's height, so the footer stays put while the body
scrolls.

## Why the form wraps all three

A submit button in a fixed footer only belongs to the fields above it if one
`<form>` encloses both. The alternative — `<button form="editor-form">` with a
matching `id` — is a second thing to keep in sync on every screen, and silently
does nothing when the two drift. So the `<form>` is the outermost element and
the three parts are its children.

`footer` is a prop: Stores passes Cancel + Save, Users passes Cancel + Reset
password + Save.

## The two non-obvious parts

- **`showCloseButton={false}`** on `SheetContent` from these callers. The header
  owns the X now; leaving Radix's own in place gives two.
- **The submit handler ignores events that are not its own**
  (`event.target !== event.currentTarget`). A dialog opened from inside the
  editor portals its own `<form>` out of the DOM but **not** out of the React
  tree, so React bubbles its submit to the editor's handler and fires a save
  nobody asked for.

## Reversal

Delete `SheetForm` and put the header/fields/actions back inline in each
editor. Nothing else depends on it.
