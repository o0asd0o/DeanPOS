# 051 — The temporary password may be generated, in the browser, into the same field

- **Status:** accepted
- **Date:** 2026-08-03
- **Stakes:** medium — amends a high-stakes credential decision
- **Asked by:** the human, as a UX improvement, with "do not remove" on typing
- **Decided by:** the human; this record states what of [043](043-the-temporary-password-is-typed-not-generated.md) survives
- **Relates to:** [032](032-the-password-policy.md), [043](043-the-temporary-password-is-typed-not-generated.md), [045](045-the-user-editor.md)

## What changed

A **Generate** button sits beside the temporary-password field, in both the
create-user editor and the reset dialog. It fills that field. Typing your own
is untouched — the field is the same field, still required, still revealable.

## What record 043 keeps, and why the amendment is narrow

043 refused generation, and its reasoning was **not** "generated passwords are
bad". It was that a *server*-generated password has to be handed back to the
admin, which means a second surface: a heading, a toast, a table cell, a
clipboard, a URL. Its no-gos are about where the value may appear.

This generator runs in the admin's own browser (`crypto.getRandomValues`) and
writes into the field they are already looking at. **No second surface exists**:
the value never travels back from the server, never touches the clipboard, and
appears nowhere but that one input with its reveal toggle. Every no-go 043
lists still holds, including its reviewer check — `generatePassword` now
appears in the codebase, so that grep needs reading with this record in hand
rather than as an automatic finding.

043's other reason — that the browser's own password manager already offers to
generate one — turned out to be true but not sufficient: it depends on the
admin's browser and profile, and it does not fire in an in-app dialog reliably.

## The number

20 characters from a 56-symbol alphabet with `l`, `I`, `O`, `0`, `1` removed —
this value gets read aloud or typed by hand, and lookalikes are the failure
mode that costs a support call. 20 is well clear of record 032's floor of 8.

## Reversal

Delete the button and `generateTemporaryPassword`; the field goes back to
typing only. Nothing server-side changed, so there is no migration and no API
surface to withdraw.
