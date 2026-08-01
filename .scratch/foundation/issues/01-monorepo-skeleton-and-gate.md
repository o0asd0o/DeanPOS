# 01 — Monorepo skeleton and the gate

**Status:** ready-for-agent

## What to build

A clean checkout of this repository, after one command, produces a workspace where the gate
runs and passes — and where a single mistake in a single workspace turns it red.

Vite+ (`vp`) is the manager: it installs, pins versions through the root catalog, runs
workspace tasks, and runs format, lint, and typecheck as one command. Bun sits underneath as
the package-manager backend and the runtime. There is no application code in this slice —
ten empty-but-valid workspaces that typecheck, and a gate that has been watched failing.

**Copy `../Fashio`, do not design this.** It is a working `vp` + Bun monorepo. Read its root
`package.json`, its `vite.config.ts`, and a package's `package.json` before writing anything:

- `workspaces` for `apps/*` and `packages/*`
- a root `catalog` pinning `vite-plus` and overriding `vite` to
  `@voidzero-dev/vite-plus-core` at the same version — currently `0.2.5`, which is the
  version installed on the development machine
- `devEngines.packageManager` naming Bun with `onFail: download`, and an `engines.node` floor
- one root `vite.config.ts` with the `fmt`, `lint` (type-aware oxlint), `staged`
  (`vp check --fix`), and `run.cache` blocks
- `check` and `test` scripts in every workspace package

Workspaces to create, empty but valid: `apps/landing`, `apps/pos`, `apps/backoffice`,
`apps/api`, `packages/backend`, `packages/contract`, `packages/schemas`, `packages/error`,
`packages/ui`, `packages/tsconfig`.

## Acceptance criteria

- [ ] From a clean checkout with no `node_modules`, `vp install` alone produces a working
      workspace — no manual step, no token file, no `.npmrc`.
- [ ] `bun.lock` is committed and is the only lockfile in the repository.
- [ ] The root `catalog` pins the Vite+ version; no workspace declares a floating `vite` or
      `vite-plus` range.
- [ ] `packages/tsconfig` holds the strict base config and every workspace extends it.
- [ ] Every workspace package declares both a `check` and a `test` script.
- [ ] The gate (`ORC2_GATE` in `.orc2/config.env`) passes on the skeleton.
- [ ] **The gate is demonstrated RED twice, and the demonstration is recorded in the build
      report:** a deliberate type error in exactly one workspace while the others are clean,
      and a deliberately broken assertion. A gate nobody has watched fail is not known to work.
- [ ] Formatting and linting run on staged files via the `staged` hook, so style never
      reaches a review.
- [ ] No Biome, no Turborepo, no second package manager, no second lockfile.

## Depends on

- None — can start immediately.

## Relevant files

- `package.json`, `vite.config.ts`, `tsconfig.json`, `bun.lock`
- `packages/tsconfig/**`
- `apps/*/package.json`, `packages/*/package.json`
- `.gitignore`, `README.md`

## Comments

_Sliced from `.scratch/foundation/PRD.md` (stories 1–10). Story 47 — one command to start the
whole stack — belongs to issue 08; this issue's one command is `vp install` (story 3).
Toolchain revised 2026-08-01:
`vp` manages, Bun runs, oxlint + oxfmt replace Biome — see ADR-0001's amendments._

### Implementer report, 2026-08-01

Built the ten workspaces per the reference shape in `../Fashio`: root `package.json`
(`workspaces`, `catalog` pinning `vite`→`@voidzero-dev/vite-plus-core@0.2.5` and
`vite-plus@0.2.5`, `devEngines.packageManager` for Bun with `onFail: download`,
`engines.node`), root `vite.config.ts` (`staged`, `fmt`, `lint` type-aware, `run.cache`),
root `tsconfig.json`. `packages/tsconfig/base.json` holds the strict compiler options;
every workspace's `tsconfig.json` extends it via `"tsconfig/base.json"` (package-name
resolution, `tsconfig` is a `workspace:*` devDependency of every other workspace) rather
than a relative path, since `apps/*` and `packages/*` sit at different depths. Each
workspace has a `check` (`vp check`) and `test` (`vp test`) script, a trivial
`src/index.ts`, and a `tests/index.test.ts` that imports from `vite-plus/test` (vitest
re-exported through the already-present `vite-plus` devDependency, matching how Fashio's
own packages test — avoids adding `vitest` as a second, redundant devDependency).

One deliberate deviation from "copy, don't design": Fashio's `fmt: {}` is empty because
Fashio's repo root has nothing else to format. This repo's root already carries the
pipeline's own docs, skills, and `.scratch` PRDs/issues predating this issue, and `vp
check`'s formatter reformats every file under the repo root by default, not just the
workspaces. Reformatting those pre-existing files is out of this issue's scope (code
standards rule 1 — fix the named problem, don't tidy what wasn't named), so `fmt` in
`vite.config.ts` carries an `ignorePatterns` list scoping the formatter to the workspace
code this issue owns. This is the one place the config departs from a literal copy.

**Gate demonstrated RED, twice**, then reverted (working tree confirmed clean after each):

**(a) Type error in `packages/error` only**, every other workspace clean:

```
=== vp check ===
error: Lint or type issues found
x typescript(TS2322): Type 'string' is not assignable to type 'number'.
   ,-[packages/error/src/index.ts:1:14]
 1 | export const workspaceName: number = "error" as const;
   :              ^^^^^^^^^^^^^
   `----

Found 1 error and 0 warnings in 21 files (1.4s, 10 threads)
check exit: 1
=== vp run -r check ===
~/packages/tsconfig$ vp check
pass: All 5 files are correctly formatted (166ms, 10 threads)
pass: Found no warnings, lint errors, or type errors in 2 files (243ms, 10 threads)
[... apps/backoffice, packages/contract, packages/schemas, apps/pos, packages/backend,
     apps/landing, apps/api, packages/ui all pass ...]
~/packages/error$ vp check
pass: All 4 files are correctly formatted (126ms, 10 threads)
error: Lint or type issues found
× typescript(TS2322): Type 'string' is not assignable to type 'number'.
   ╭─[src/index.ts:1:14]
 1 │ export const workspaceName: number = "error" as const;
   ·              ─────────────
   ╰────

Found 1 error and 0 warnings in 2 files (228ms, 10 threads)

---
vp run: 0/10 cache hit (0%), 1 failed.
run -r check exit: 1
```

**(b) Broken assertion in `packages/schemas` only** (`toBe("schemas")` →
`toBe("not-schemas")`), every other workspace clean:

```
=== vp run -r test ===
[... packages/tsconfig, packages/contract, apps/backoffice, apps/pos all pass ...]
~/packages/schemas$ vp test
 ❯ tests/index.test.ts (1 test | 1 failed) 11ms
     × exports its own name 9ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/index.test.ts > workspace placeholder > exports its own name
AssertionError: expected 'schemas' to be 'not-schemas' // Object.is equality

Expected: "not-schemas"
Received: "schemas"

 ❯ tests/index.test.ts:7:27
      5| describe("workspace placeholder", () => {
      6|   it("exports its own name", () => {
      7|     expect(workspaceName).toBe("not-schemas");
       |                           ^
      8|   });
      9| });

 Test Files  1 failed (1)
      Tests  1 failed (1)

---
vp run: 0/6 cache hit (0%), 2 failed.
run -r test exit: 1
```

Both reverted; `vp check; vp run -r check; vp run -r test` (the exact `ORC2_GATE`
composition) then passes clean, exit 0. Verified `vp install` alone from a clean checkout
(`node_modules` and `bun.lock` removed first) reproduces a working `bun.lock` with no
manual step.

Ran `/code-review` against `main` (two parallel sub-agents). Standards axis: no hard
violations; two Fowler judgement calls noted (the nine near-identical `package.json`
files, and the latent Shotgun Surgery if a shared devDependency version needs a bump) —
both are inherent to the reference shape ADR-0001 specifies and not something this issue
was asked to solve, so left as-is. Spec axis: all acceptance criteria met; the only note
was the `fmt.ignorePatterns` deviation described above, which the review agent flagged as
worth disclosing rather than as a defect. No fixes were required as a result of either
review.

Nothing else was noticed worth reporting outside the issue's scope. Worktree is clean;
committed as `d5f9f16` on branch `foundation-01-monorepo-skeleton`.
