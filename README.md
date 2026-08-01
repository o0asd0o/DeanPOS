# DeanPOS

## Setup

```
vp install
```

That is the only setup step. `vp` (Vite+) manages installs, the dependency catalog, and
workspace task running; Bun is the package-manager backend underneath it and the runtime
`apps/api` serves on. Versions are pinned in the root `package.json` `catalog`.

## Gate

```
vp check
vp run -r check
vp run -r test
```

`vp check` runs format, lint, and typecheck at the root. `vp run -r check` and
`vp run -r test` run each workspace's own `check` and `test` script. A type error, a lint
error, or a failing test in any single workspace turns the whole gate red.

## Layout

- `apps/landing`, `apps/pos`, `apps/backoffice`, `apps/api` — the four applications.
- `packages/backend`, `packages/contract`, `packages/schemas`, `packages/error`,
  `packages/ui`, `packages/tsconfig` — shared packages. `packages/tsconfig` holds the
  strict base TypeScript config every workspace extends.

See `docs/adr/0001-stack-and-monorepo-shape.md` for the shape and why it is fixed.
