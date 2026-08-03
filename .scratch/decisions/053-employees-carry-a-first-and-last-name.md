# 053 — An Employee carries a first and last name

- **Status:** accepted
- **Date:** 2026-08-03
- **Stakes:** medium — a schema column and a reversal of a ranked decision
- **Asked by:** the human, directly
- **Decided by:** the human; this record states what [044](044-the-users-list.md) weighed and what changed
- **Relates to:** [044](044-the-users-list.md), [045](045-the-user-editor.md)

## What changed

`User` gains `first_name` and `last_name`. Both are required on
`user.create` and `user.update` (trimmed, minimum one character), the editor
asks for them above the email, and the list shows a `Name` column ahead of
`Email`.

## This reverses a ranked decision, and the ranking still reads correctly

044 ranked "no name field; `Email` is the row identity" first at 44, and
"add `User.name`; `Name` first, `Email` second" second at 33. The gap was
**not** about usefulness — 044 scored the name option *higher* on user value
(5 against 4). It lost on engineering cost and reversibility, because at that
moment every other source in the product agreed there was no name: the schema,
issue 06's criteria, the PRD story, `meOutputSchema`.

That is what the human changed. With the name asked for, the cost 044 priced —
a column, a migration, two schema fields, a form row — is the cost of the thing
being asked for rather than of a guess.

Two of 044's rules survive untouched: **the email is still never truncated**,
and there is still **no `PIN` column** (that belongs to issue 10, and record
009 forbids an empty reserved box).

## Two names, not one

044's option 2 was a single `name`. Two fields sort, address and search
differently — "Reyes, Ana" in a roster, "Ana" on a greeting — and splitting
later means parsing a free-text field, which is the expensive direction.

## Existing rows

The migration is additive with `DEFAULT ''`, so every row that predates it is
valid the instant it runs. **`''` means "no name on record", not "blank name"**:
the list renders `—` for it. The API requires a name from now on but does not
rewrite history to pretend one was given, and no backfill invents one.

## Reversal

Drop two columns, two schema fields, the form row and the list column. The
column defaults make the migration safe to run forward again if it is put back.
