---
name: lofi-to-code
description: Build a screen from a lo-fi mock or sketch. Use when an issue's visual reference is an image in the lo-fi directory rather than a pixel-exact design file. Covers what the mock does and does not decide, how to fill the gaps from existing tokens, and what to flag rather than invent.
---

# Lo-fi to code

A lo-fi mock fixes **what is on the screen and in what order**. It does not fix how it looks. Building it as though it were pixel-exact produces a screen that is confidently wrong in every detail nobody drew.

## What the mock decides, and what it does not

| The mock decides                        | The mock does not decide                          |
| --------------------------------------- | ------------------------------------------------- |
| Which sections exist, and in what order | Spacing, padding, gap values                      |
| Hierarchy — what is primary, secondary  | Type scale, weight, line height                   |
| Which controls exist and roughly where  | Exact colour                                      |
| Content and copy, where written in      | Hover, focus, disabled, loading, empty, error     |
| Rough grouping and column counts        | Behaviour at widths the mock does not draw        |

Everything in the right column comes from **the project's existing design tokens and shipped components**, never from measuring the mock and never from a fresh value invented for this screen. Measuring a lo-fi mock produces precise numbers that mean nothing.

## Before coding

1. **Read the mock at full size.** `design/lofi/` holds them. Note which widths exist — if only one, the others are your translation, and you must say so.
2. **Read the design system.** The token file is the vocabulary. Every value you write should be a token unless the mock explicitly overrides it.
3. **Read the nearest existing screen.** Same layout primitives, same spacing rhythm, same component set. A new screen that introduces a second visual language is a finding, not a contribution.
4. **List what the mock does not answer.** Interaction states, empty states, error states, the narrowest width. This list is not something you fill in with judgement — see below.

## The gaps are not yours to fill

Anything in that list is an open question. It goes back to the orchestrator, which routes it to the `decider`, which writes a record naming the actual values. You then implement the record.

This is the whole reason a lo-fi pipeline can run unattended: the ambiguity is resolved once, in writing, instead of re-invented by every agent that reads the mock. An implementer that guesses produces a screen nobody can review, because there is nothing to review it against.

**Two exceptions you may decide yourself**, because the codebase already answers them:

- A value the design system has exactly one token for, in a context that clearly matches.
- A state an existing component of the same kind already implements — copy its treatment.

Anything else: flag it, and say specifically what you would have had to invent.

## Build

Match structure and order exactly. Use tokens for everything else. Then:

- **Implement every state**, not just the one drawn. A control with no focus style is not done.
- **Implement the narrowest supported width**, even when the mock is desktop-only. A single column that keeps the mock's order is the correct default; a horizontally scrolling row is not.
- **Semantics before appearance.** Headings are headings, buttons are buttons, lists are lists. A lo-fi mock cannot tell you this, and getting it wrong is the accessibility failure that survives review.

## Verify

1. **Structure and order** against the mock, side by side, at every width it covers.
2. **Contrast against WCAG 2.2 AA** for every text and background pair you used. Accessibility outranks anything drawn.
3. **Keyboard** — reach every control, see focus on each one, complete the flow without a mouse.
4. **The gate** — `bun run check`, `bun run test`. Document any pre-existing failure; never claim a clean gate when one was already failing.

## Report

Name the mock file, the widths you built, every token you chose where the mock was silent, every state you added that the mock did not draw, and — separately and explicitly — **everything you had to eyeball**. That last list is what a human reviews. Omitting it is how a lo-fi build passes review and fails in front of a user.
