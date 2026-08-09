---
name: close-acceptance-criteria
description: Implement and close a local markdown engineering issue end-to-end. Use when the user asks to implement an issue, complete/tick acceptance criteria, resolve what is missing, or mark an issue done.
---

# Close Acceptance Criteria

Implement the named issue, then prove and close its acceptance criteria. Do not treat unchecked boxes as proof of missing work, or checked boxes as proof of completion.

## Workflow

1. Read the issue, parent PRD when needed, project `AGENTS.md`, relevant code, existing tests, and named visual references.
2. Implement the issue's requested work before touching the issue ledger. Follow the repository's test-first workflow; use the smallest in-scope change and preserve unrelated work.
3. Run focused checks while implementing. Do not tick ACs during this first implementation pass.
4. Audit every AC after the implementation pass. Build a compact ledger: criterion → implementation evidence, test evidence, status (`pass`, `missing`, or `blocked`).
5. Implement every missing AC. Add or update focused tests for behavioral ACs. Include the project accessibility checker when required. For performance/network ACs, prove the stated boundary with a failing transport or equivalent.
6. Re-run the AC audit after fixes. Repeat steps 5–6 until every AC is proven or the user must decide a genuine ambiguity/blocker.
7. Update the issue only after the final audit passes:
   - Tick every proven AC.
   - Set `Status: done` only when every AC is proven or explicitly accepted as blocked by the user.
   - Append a short `## Comments` build report. Record breakpoint or behavior translations not specified by a reference.
8. Run focused tests, static checks, and the strongest safe broader verification. Distinguish product failures from environment blockers. Commit implementation, tests, and issue ledger together when repository workflow requires commits. Report final AC status, proof, and blockers.

## Guardrails

- Keep deferred work in its owning issue; do not implement a later issue to make an AC appear complete.
- Never invent server procedures, schema changes, or sync behavior unless the issue asks for them.
- Do not mark an AC done from visual inspection alone when it asserts behavior, accessibility, persistence, authorization, or network limits.
- If a criterion is ambiguous or needs a product choice, stop at `blocked` and ask the user; do not silently weaken the AC.
