---
name: run-issue
description: Run one DeanPOS issue through the full implement, review, fix pipeline and stop. Takes an issue number, optionally with its PRD name. Use when driving a single slice rather than a whole PRD.
---

# Run one issue

Drive exactly one issue through the pipeline, then stop.

## Resolve the argument

The argument is an issue number, optionally preceded by its PRD name — `03`, or `foundation 03`, or `foundation/03`.

Find the matching issue. If a bare number matches issues in more than one PRD, do not guess — list the matches and ask which one. If it matches nothing, say so and list what is available rather than picking something close.

## Check before starting

- The working tree is clean. If not, stop and say so; the pipeline creates worktrees and merges, and uncommitted work makes that unsafe.
- The issue is ready for an agent. Any other state means stop and report what it says.
- Its dependencies are all closed. If a blocker is open, stop and name it.

## Run

Read `.orc2/ORCHESTRATOR.md` and follow its per-issue section exactly — select, implement, gate, review, fix loop capped at 2 rounds, then close or escalate.

Everything in that file applies, in particular: you run `vp check`, `vp run -r check`, `vp run -r test` yourself and treat the exit codes as ground truth, never an agent's claim that they passed.

Stop after this one issue. Do not pick up the next one even if it is unblocked and obvious.

## Report

- Issue and outcome — merged, or escalated and why
- Review rounds used, and what each round found
- The exact gate commands run, and their real results
- Approximate token cost
- Anything escalated, or any acceptance criterion you could not verify

State failures plainly. A criterion satisfied by an agent's assertion rather than by something observable is worth calling out as such.
