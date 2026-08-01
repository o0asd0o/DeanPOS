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

_Sliced from `.scratch/foundation/PRD.md` (stories 1–10, 47). Toolchain revised 2026-08-01:
`vp` manages, Bun runs, oxlint + oxfmt replace Biome — see ADR-0001's amendments._
