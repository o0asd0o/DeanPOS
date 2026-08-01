# 005: The Prisma commands become root scripts, and the root `.env` reaches them

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** reviewer, blocking on `.scratch/foundation/issues/03-data-layer-and-lane-database.md`

## The question

Three binding documents cannot all hold. `.orc2/config.env` and ADR-0004 say the
pipeline runs `vp exec prisma generate` at the repository root; ADR-0008 and issue 03
put the Prisma schema inside `packages/backend`; and `prisma` is only installed in
`packages/backend`, so that command fails at the root. A second, joined question:
the migrate commands additionally need a database URL, and the file holding it is at
the repository root where those commands cannot see it.

What a wrong answer costs: `main` goes red immediately after any merge that touches
the schema, and a fresh clone never reaches a green gate — the `foundation` PRD names
that scenario a defect of itself.

## What I chose, and why

**Give the repository root three named scripts, and point the pipeline at those names
instead of at raw commands.**

The root gets `codegen`, `migrate`, and `migrate:status`. Each one internally does the
scoping — it runs the Prisma binary inside `packages/backend`, where that binary
actually lives. The pipeline's three settings become `vp run -w codegen`,
`vp run -w migrate`, and `vp run -w migrate:status`. Nothing moves out of
`packages/backend`; `prisma` stays declared in exactly one manifest; ADR-0008's layout
and record 004 are untouched.

Two things made this the answer rather than the more obvious "just add `-F backend` to
the three settings".

The first is the environment. Prisma looks for a `.env` file in the directory it is
run from, in the directory holding the schema, and in a folder literally called
`prisma/` — and it **never looks in parent directories**. The moment you scope the
command into `packages/backend`, the root `.env` is out of reach, which is exactly the
failure the reviewer saw. A script can fix this in its own body: it reads the root
`.env` into the environment first, then runs the command. Putting that inside a named
script is the only place it can live, because the alternative is a line of shell
punctuation pasted into a config file that three different documents quote verbatim.

The second is the PRD's actual pass condition: a clean clone plus an install must reach
a green gate **with no manual step**. No amount of fixing the command's spelling
achieves that on its own, because somebody still has to remember to run it. A `prepare`
script does achieve it — package managers run `prepare` at the end of an install, so
the generated types exist before anyone types a gate command. The named cost of this
shape is that it runs on every install and a failure blocks the install. Here that cost
is close to zero and the failure mode is honest: this particular generation takes six
milliseconds, touches no network and no database, and the only way it can fail is a
malformed schema — which is a broken build regardless of when you find out.

I could not verify from primary sources that `vp install` runs the root package's
`prepare` hook; the vite-plus documentation does not cover lifecycle scripts, and Bun's
documented default denies them for *dependencies*. It is standard behaviour for a
project's own scripts, and the sibling repository `Fashio` already relies on a root
`prepare`. Rather than assume it, the acceptance test below asserts it directly, and
the record carries a pre-decided fallback so a fixer never has to re-open this.

What would make this decision wrong: if `vp install` turns out not to fire `prepare`,
apply the named fallback (below) rather than reverting. If Prisma is upgraded to 7, the
`package.json` `"prisma"` key that locates the schema is removed and `packages/backend`
needs a `prisma.config.ts` — which also disables `.env` auto-loading, though the
scripts' own `.env` sourcing already covers that. Re-check this record at that upgrade.

## The options, ranked

| Rank | Option | User | Business | Eng cost/risk | Reversibility | Evidence | Total |
| ---- | ------ | ---- | -------- | ------------- | ------------- | -------- | ----- |
| 1 | Root scripts + `prepare` (chosen) | 4 | 4 | 4 | 5 | 4 | **21** |
| 2 | Bare `-F backend` in the three settings | 2 | 2 | 5 | 5 | 4 | 18 |
| 3 | Declare `prisma` at the root, pass `--schema` | 4 | 3 | 3 | 4 | 4 | 18 |
| 4 | Do nothing / defer | 1 | 1 | 5 | 5 | 3 | 15 |
| 5 | Fix codegen only, leave migrate alone | 2 | 1 | 3 | 5 | 3 | 14 |

Weights are equal across the five criteria, declared before options existed;
engineering cost/risk and reversibility were declared as the tie-breakers, because
these are commands the pipeline runs unattended at every merge, where a failure is
silent and repeats.

**1 — Root scripts + `prepare`.** Three named scripts at the root, each scoping into
`packages/backend`; the two migrate scripts source the root `.env` first. Wins on every
binding constraint at the smallest diff, and it is the only option that satisfies the
PRD's "no manual step" clause rather than merely improving on the status quo. Its one
real cost is a new constraint nobody has had to think about before: values in `.env`
are now read by a shell, so a value containing spaces, `&`, or `?` must be quoted. That
is recorded here and belongs in `.env.example`.

**2 — Bare `-F backend` in the three settings.** The reviewer's option (a), and the
closest thing to a fallback, which is why it ranks second on a tie broken by
reversibility. It is a three-value edit and it genuinely fixes codegen. It fails on two
counts: the migrate commands still cannot see the root `.env`, for the reason described
above, and a clean clone still gates red because nothing regenerates at install time.
It is not wrong so much as incomplete — the chosen option is this option plus the two
pieces it is missing.

**3 — Declare `prisma` at the root and pass `--schema`.** Genuinely attractive, and I
spent real time on it: keeping the working directory at the root means Prisma finds the
root `.env` by its own native lookup, with no shell sourcing and no new constraint. It
lost on cost. It puts `prisma` in two manifests, which is version drift waiting to
happen unless the catalog is also changed; it still needs a `prepare` script to satisfy
the PRD clause, so it is strictly *larger* than the chosen option rather than an
alternative to it; and it sits closest to the `prisma.config.ts` route, which is a trap
— that file disables Prisma's `.env` auto-loading outright and would require adding
`dotenv`. This is the option to move to if the shell-sourcing in option 1 ever becomes
a problem.

**4 — Do nothing / defer.** Considered and rejected on consequence, not on effort.
Deferring means every schema-touching merge leaves `main` red, and the orchestrator
cannot tell that red apart from a genuinely bad merge — which is the specific cost
ORCHESTRATOR.md already calls out at step 4. It ranks above option 5 only because it
does not actively create a new inconsistency.

**5 — Fix codegen only, leave migrate alone.** Ranked last deliberately. It leaves
`ORC2_MIGRATE_CMD` spelled differently from `ORC2_CODEGEN_CMD` for no stated reason,
which is the outcome the question explicitly named as worse than either half. It also
guarantees the migrate half gets rediscovered later by someone with less context.

## How to turn it back

The whole change is additive and lives in four files. To reverse:

1. Write a superseding record and flip this one's `Status:` to `overturned` with the
   date and reason.
2. Delete the `scripts` block from the root `package.json` — it did not exist before
   this decision, so removal restores the original file exactly.
3. Restore the three values in `.orc2/config.env` to their pre-decision strings:
   `vp exec prisma generate`, `vp exec prisma migrate deploy`,
   `vp exec prisma migrate status`.
4. Restore `.orc2/ORCHESTRATOR.md` lines 175, 184, 194, 195 to the same three strings.
5. Delete the amendment line appended to `docs/adr/0004-prisma-schema-kysely-runtime.md`.

This is a one-commit revert with no migration to unwind and no generated state to
repair — reversibility 5. What has been built on top of it by then: nothing product-side
can depend on these scripts, because they only invoke Prisma. The one thing that grows
is documentation — any later issue or ADR that quotes `vp run -w codegen` must be
re-synced, so grep for that string before reverting.

Note that reverting returns the repository to a state where a clean clone does **not**
gate green. Do not revert without replacing the mechanism.

## Instructions for the fixer

Apply exactly this. Nothing here is open.

**1. `.orc2/config.env` — replace three lines (6, 20, 21):**

```
ORC2_CODEGEN_CMD="vp run -w codegen"
ORC2_MIGRATE_CMD="vp run -w migrate"
ORC2_MIGRATE_STATUS_CMD="vp run -w migrate:status"
```

**2. Root `package.json` — add a `scripts` block** (it currently has none):

```json
"scripts": {
  "codegen": "vp exec -F backend prisma generate",
  "migrate": "set -a; [ -f .env ] && . ./.env; set +a; vp exec -F backend prisma migrate deploy",
  "migrate:status": "set -a; [ -f .env ] && . ./.env; set +a; vp exec -F backend prisma migrate status",
  "prepare": "vp run -w codegen"
}
```

The `[ -f .env ] &&` guard is required, not decorative: it lets the command fall
through to real environment variables in any context with no `.env` file.

**3. `.orc2/ORCHESTRATOR.md` — four hand edits.** This file is **not** generated (only
`AGENTS.md` has `orc2` markers), so edit it directly:

- line 175 → `vp run -w codegen`
- line 184 → `vp run -w codegen`
- line 194 → `vp run -w migrate:status`
- line 195 → `vp run -w migrate`

Leave `<install dependencies>` at line 183 as it is. Step 4's explicit codegen is now
redundant with `prepare` but is idempotent and takes milliseconds — keep it, because the
lane-worktree call at line 175 runs after a conflict resolution with no install.

**4. `docs/adr/0004-prisma-schema-kysely-runtime.md` — append below the pipeline
commands block, verbatim:**

```
**Amended 2026-08-02** (`.scratch/decisions/005-prisma-command-scope-and-env.md`): the
commands above are now root `package.json` scripts — `vp run -w codegen`,
`vp run -w migrate`, `vp run -w migrate:status`. `prisma` is installed only in
`packages/backend`, so its binary does not resolve at the repository root; each script
scopes into that workspace with `vp exec -F backend`. The two migrate scripts also
source the root `.env` first, because Prisma searches for `.env` in the working
directory, the schema's directory, and `./prisma/` only — it never walks up to a
monorepo root. The decision itself (Prisma owns schema and migrations, Kysely owns
runtime) is unchanged.
```

**5. `.env.example` — add a comment line** above `DATABASE_URI=`:

```
# Values are sourced by a shell in the root migrate scripts — quote any value
# containing spaces, & or ?.
```

**6. Do not run `orc2 render`, and do not hand-edit `AGENTS.md`.** The only rendered
block is `AGENTS.md`'s `<!-- orc2:agent-skills -->` section, which contains none of
these commands. A re-render is unnecessary and harmless; it will not pick these up
either way.

**How the environment reaches the migrate commands:** from the root `.env`, sourced by
the script body. In a lane worktree that is the lane's own `.env` pointing at
`DeanPOS_lane_*`; at the repository root it is the human's `.env` pointing at
`DeanPOS_dev`. Both are already provisioned by ORCHESTRATOR.md's lane-setup step
(lines 79–90). `codegen` needs no environment.

**What is NOT changed:** ADR-0008's layout, record 004, `packages/backend/package.json`
(its `"prisma": { "schema": ... }` key still locates the schema), and `ORC2_GATE`.

## Acceptance test

This is what proves the PRD's clause. Run it from a clean clone, not from a worktree.

```
git clone <repo> /tmp/deanpos-clean && cd /tmp/deanpos-clean
cp .env.example .env
printf 'DATABASE_URI=postgresql://<user>@localhost:5432/DeanPOS_dev\n' > .env
vp install
test -f packages/backend/src/db/prisma/generated/types.ts   # (1) prepare fired
vp check; vp run -r check; vp run -r test                    # (2) ORC2_GATE, must be green
vp run -w migrate:status                                     # (3) resolves the datasource
```

Then the regeneration path the orchestrator depends on:

```
rm -rf packages/backend/src/db/prisma/generated
vp run -w codegen
test -f packages/backend/src/db/prisma/generated/types.ts
```

**If assertion (1) fails** — `vp install` does not fire the root `prepare` hook — do
not re-open this decision. Apply the pre-decided fallback: set

```
ORC2_GATE="vp run -w codegen; vp check; vp run -r check; vp run -r test"
```

in `.orc2/config.env`, leave everything else as specified, and re-run the sequence. Note
which branch was taken on issue 03.

## Evidence

Repository, read 2026-08-02:

- `.orc2/config.env` lines 6, 14, 20, 21 — the three command settings and `ORC2_GATE`.
- `.orc2/ORCHESTRATOR.md` lines 79–90 (lane provisioning creates the lane `.env`),
  146–199 (merge procedure), 175/184/194/195 (the four command occurrences).
  Confirmed by search that this file carries no `orc2` render markers — only
  `AGENTS.md` does, at lines 1 and 28.
- `docs/adr/0004-prisma-schema-kysely-runtime.md` lines 21–27; `docs/adr/0008-backend-module-structure.md` lines 23–42.
- `.scratch/foundation/issues/03-data-layer-and-lane-database.md` lines 10–12, 52–59.
- `packages/backend/package.json` — `prisma` and `prisma-kysely` in `devDependencies`
  only, plus the `"prisma": { "schema": "src/db/prisma/schema.prisma" }` key.
- Root `package.json` — no `scripts` block; `catalog` mechanism in use (`fast-check`
  pinned there per record 002).
- `vitest.setup.ts` — tests read `.env` themselves into `process.env`; this path is
  unaffected by the decision.
- `.gitignore` — `**/generated/**` at line 11, `.env` at lines 14–16.
- Sibling `/Users/jomelortega/Desktop/personals/PremiumSoftwares/Fashio` — root
  `package.json` with `ready`, `dev`, `prepare`; precedent for a root `prepare` hook.

External, primary sources, accessed 2026-08-02:

- Prisma environment-variable reference —
  https://www.prisma.io/docs/orm/more/development-environment/environment-variables —
  `.env` is searched in cwd, the schema's directory, and `./prisma/`; the CLI does not
  walk up the tree, and clashing `.env` files across those locations raise an error.
  This is the mechanism behind the reported `getConfig` failure.
- Prisma 6.4.0 release notes — https://github.com/prisma/prisma/releases/tag/6.4.0 —
  "If you're using `prisma.config.ts`, the Prisma CLI will not load environment
  variables from `.env` files." This is what disqualified the `prisma.config.ts` route.
- Prisma config reference — https://www.prisma.io/docs/orm/reference/prisma-config-reference
  — config is discovered in the process cwd only, not in ancestors; precedence is
  `--schema`, then `prisma.config.ts`, then `package.json#prisma`.
- Prisma 7 upgrade guide —
  https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
  — "The configuration property package.json#prisma is deprecated and will be removed
  in Prisma 7." Named above as the re-check trigger.
- vite-plus `vp run` — https://viteplus.dev/guide/run — `-w/--workspace-root`:
  "Explicitly run the task in the workspace root package." This is what makes
  `vp run -w <script>` safe regardless of the caller's working directory.

**Searched for and not found, and it mattered:** vite-plus publishes no documentation
for `vp exec`'s `-F/--filter`, `-r`, `-w`, or `--fail-if-no-match` flags
(https://viteplus.dev/guide/vpx covers only "runs a binary from the current project's
`node_modules/.bin`"), and none for whether `vp install` runs lifecycle scripts or
whether `vp run`/`vp exec` load `.env` into a child process. The `-F` behaviour is
therefore carried by the reviewer's own verified runs rather than by documentation, and
the `prepare` behaviour is carried by the acceptance test plus a pre-decided fallback
rather than being assumed. Bun's lifecycle documentation
(https://bun.com/docs/pm/lifecycle) covers `trustedDependencies` for third-party
packages and does not address a root project's own scripts.
