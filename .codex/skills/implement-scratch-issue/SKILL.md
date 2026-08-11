---
name: implement-scratch-issue
description: Implement one local engineering ticket from this repository's `.scratch` issue tracker end-to-end on `main`. Use when the user invokes `$implement-scratch-issue` with an issue path, issue number, or unique issue title and wants Codex to clarify the ticket, recommend defaults, obtain implementation confirmation, write and test the code, update only proven acceptance-criteria checkboxes, and commit the result. The ticket and repository laws replace any separately pasted implementation plan. Human reviewers own all visual checks.
---

# Implement Scratch Issue

Treat one `.scratch/<feature>/issues/*.md` ticket as the implementation source of truth. Do not
require a pasted plan.

## Required input

Require one of:

- an exact `.scratch` issue path;
- a feature plus issue number;
- a unique issue title or number discoverable under `.scratch/*/issues/`.

Resolve shorthand with `rg --files .scratch | rg '/issues/'`. If zero or multiple tickets match,
ask for the exact target and do not edit product code.

## Load only governing context

1. Read the repository `AGENTS.md` files that govern the target paths.
2. Read the selected issue completely.
3. Read its parent PRD only when needed to resolve scope or terminology.
4. Read `docs/agents/code-standards.md` before writing or reviewing product code.
5. Use `CONTEXT-MAP.md` to load only the relevant `CONTEXT.md` slice.
6. Read only ADRs, decisions, mocks, or agent docs explicitly named by the issue or directly
   implicated by the change. Follow `.scratch/decisions/LOG.md` routing; never dump directories.

Do not use an attachment, chat plan, or invented roadmap as a second specification. User
instructions given with the invocation may override the ticket explicitly.

## Align before implementation

Inspect the repository enough to distinguish discoverable facts from actual product decisions.
Then give a layman's summary containing:

- what will change;
- what will remain out of scope;
- important behavior on success and failure;
- any material assumptions or conflicts.

Ask only questions whose answers materially change behavior, data, API shape, security, or scope.
For every question, recommend one option and state its tradeoff. Ask dependency-ordered questions;
do not ask downstream questions before upstream choices are resolved.

Accept replies such as `do reco` as approval of the stated recommendation. Continue clarification
until no material ambiguity remains. Present the final implementation decisions and require an
explicit confirmation such as `confirm` or `continue` before editing product code.

Do not ask about facts that repository inspection can answer. Do not begin implementation merely
because the ticket exists.

## Implement on main

After confirmation:

1. Verify the current branch is `main`. If not, report it and obtain permission before switching.
2. Inspect the worktree. Preserve unrelated user changes and untracked files.
3. Build an internal criterion ledger: `AC -> code evidence -> test evidence -> status`.
4. Add or update tests before production behavior when practical. Prove the relevant failure first.
5. Implement the smallest coherent change satisfying the ticket and confirmed decisions.
6. Follow existing architecture, transaction, tenancy, authorization, schema, and error patterns.
7. For migrations, verify generated types and migration status without destructive database resets.
8. Run focused tests during development, then proportionate static checks and relevant broader tests.
9. Perform a final security and regression review for changed input, API, auth, tenant, payment, and
   persistence surfaces.

Never broaden the ticket to adjacent issues. Do not fix unrelated baseline failures unless they
block this issue and the user authorizes the expansion.

## Visual verification boundary

Human reviewers own visual verification.

- Do not open a browser.
- Do not run Playwright for visual review.
- Do not capture or compare screenshots.
- Do not perform responsive-layout, pixel, spacing, typography, color, animation, or aesthetic
  checks.
- A named mock may inform implementation, but never claim the result visually matches it.
- Behavioral component tests and non-visual accessibility automation are allowed, but they do not
  prove a layout or appearance criterion.

At handoff, provide a short manual visual checklist derived from the issue. Leave every visual-only
AC unchecked until the human explicitly confirms it passed. Never infer human approval.

## Close acceptance criteria

For each checkbox:

- tick it only when implementation evidence and required non-visual tests pass;
- leave it unchecked when blocked, failing, untested, or awaiting human visual confirmation;
- never rewrite an AC to make it easier to pass;
- add concise issue comments linking decisions and proof when the tracker format permits.

Set the issue's canonical done status only when every AC is checked. Read the local tracker and
triage-label docs before changing status. If visual ACs remain, keep a valid non-done status and
state exactly what human confirmation is required.

## Commit and handoff

Commit intentional changes on `main` with a concise human-readable message. If human visual review
is pending, commit the implementation and proven ledger state without marking the issue done; after
explicit human PASS, update the remaining checkboxes/status and create a closure commit.

Report:

- issue path and status;
- checked/total AC count;
- implementation outcome in plain language;
- focused and broad verification results;
- unrelated baseline failures separately;
- manual visual checklist and pending visual ACs;
- commit hash;
- untouched user changes.

Pass condition: all non-visual ACs have evidence, all relevant automated checks pass or documented
baseline failures are proven unrelated, human confirms every visual-only AC, all ACs are checked,
the issue uses its canonical done status, and the closure commit succeeds.
