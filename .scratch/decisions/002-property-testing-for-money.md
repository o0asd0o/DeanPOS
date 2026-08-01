# 002: Money gets property tests from `fast-check`, and nothing else is added

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-01
- **Asked by:** `.scratch/foundation/issues/02-money-primitives.md` (routed by the orchestrator)

## The question

Issue 02 and the Foundation PRD both require the money functions to be tested
against *rules that must hold for every input*, not against a handful of
hand-picked examples. The repository has no tool that can do that. So: how do
we generate those inputs, and do we install someone else's library to do it?

A wrong answer costs one of two ways. Install the wrong thing and it spreads
into four later areas that all compute money, and pulling it out means
rewriting every money test in the project. Install nothing and write our own,
and the tests only ever try the inputs the person who wrote the code thought
of — which is exactly what an example test already does, dressed up.

## What I chose, and why

**Add `fast-check` version `4.9.0`, as a development-only dependency, pinned in
the root catalog. Add nothing else.** In particular, do **not** add the
companion package `@fast-check/vitest`, and do not hand-roll our own generator.

Three things decided this.

**It never ships to a customer.** `packages/schemas` sits underneath everything
— the contract package depends on it, and both front ends depend on the
contract. Anything listed there as a normal dependency ends up in the cashier
terminal's downloaded application. Listed as a *development* dependency, it is
only ever present on a developer's machine and cannot reach that bundle. This
is the difference between a decision I am allowed to make and one I would have
had to send to a human, and it is why the record insists on the distinction.

**The companion package would drag a second copy of the test runner in.** Our
tests import their tools from `vite-plus/test`. The actual runner, Vitest, is
buried inside the Vite+ tool at an exact pinned version and is deliberately not
something this repository asks for by name — issue 01 made that choice on
purpose and it passed review. `@fast-check/vitest` demands Vitest by name.
Since there is no shared copy for it to find, installing it would fetch its own
second copy, and tests would then be assembled from two different runners that
merely look identical. It would also chain our test suite to whichever runner
version Vite+ happens to carry, and Vite+ is the single tool every command in
this repository runs through. All of that risk buys ergonomics: a shorter way
to write the same test. The one genuinely new capability it offers — running
setup and teardown around each generated case — is worthless here, because the
PRD describes these functions as pure with no I/O. There is nothing to set up.
Plain `fast-check` needs no runner integration at all and so carries none of
this.

**Writing our own is a bigger job than it looks, in the worst place to
underestimate.** A seeded random number generator really is about twenty lines.
The part that matters is *shrinking* — when a test fails on some twelve-digit
number, shrinking is what boils it down to the smallest input that still
fails, which is the difference between a bug you can read and a bug you stare
at. That is the hard part, and we would be writing it ourselves, untested, in
the money path. It also gets worse later: the checkout area says its properties
run "over generated catalogs and carts", so we would need generators that
compose into whole shopping carts. At that point we are writing a library, not
avoiding one. And a generator written by the same person as the code under test
inherits that person's blind spots — the reason to use a mature one is that its
generators deliberately favour the awkward values (zero, one, the boundary, the
largest safe integer) that nobody remembers to try.

**On the float ban.** ADR-0005 forbids floating-point numbers — the kind that
can turn 0.1 + 0.2 into 0.30000000000000004 — in every layer of the product.
I checked this specifically, because it was the constraint most likely to rule
out the obvious answer. It does not. Generating a whole number in `fast-check`
runs through a whole-number code path end to end; the fractional generators are
separate functions you have to ask for by name. So the rule below is simply
"never ask for them", and that is a reviewable rule rather than a hope. Note
also that ADR-0005 governs the values the *product* stores and sends. A test's
generator is not one of those layers; what ADR-0005 requires of it is only that
every value it hands to the functions under test is an exact whole number, and
the generators named below guarantee that by construction.

### Weights used for the ranking

Declared before the options were scored. Not equal, and here is why: this is
test-only tooling. It is invisible to customers and it earns and costs nothing,
so those two criteria barely separate the candidates. What actually separates
them is what they cost to run on a local gate, what they cost to remove after
four areas depend on them, and how well established their behaviour is.

| Criterion | Weight |
| --- | --- |
| User impact | ×1 |
| Business impact | ×1 |
| Engineering cost and risk | ×2 |
| Reversibility | ×2 |
| Evidence strength | ×2 |

Maximum possible total: 40. Weights were **not** changed after scoring.

## The options, ranked

| Rank | Option | User | Business | Eng cost/risk | Reversibility | Evidence | Total |
| ---- | ------ | ---- | -------- | ------------- | ------------- | -------- | ----- |
| 1 | **`fast-check` alone** | 4 | 4 | 5 | 4 | 5 | **36** |
| 2 | `fast-check` + `@fast-check/vitest` | 4 | 3 | 2 | 3 | 4 | **25** |
| 3 | Defer — examples only for now | 1 | 1 | 5 | 5 | 1 | **24** |
| 4 | Hand-rolled seeded generators | 2 | 3 | 2 | 4 | 2 | **21** |

**1. `fast-check` alone — chosen.** Two packages total (`fast-check` and its
only dependency, `pure-rand`), MIT licensed, no configuration, and no
relationship of any kind to the test runner — it is called as a plain function
inside an ordinary test. It reports a reproducible seed and a shrunk
counterexample on failure. Scores highest on the three criteria that carry
double weight.

**2. `fast-check` + `@fast-check/vitest`.** Ranked second, and the gap is not
close. Its version compatibility is genuinely fine — I expected it to be the
problem and it was not, the current release accepts the runner version we
resolve. It loses on the second-copy-of-the-runner problem and on tying our
tests to the runner version Vite+ vendors, in exchange for syntax sugar whose
one real capability does not apply to pure functions. Worth reopening only if
we later test something with real setup and teardown per generated case, and
if Vite+ by then exposes Vitest as a shared dependency rather than a buried one.

**3. Defer — examples only.** Considered and rejected, but read its score
honestly: 20 of its 24 points come from the two criteria that *any* decision to
do nothing trivially maximises. It is free and perfectly reversible because it
does nothing, and it fails the question that was asked. Both the PRD and the
issue's acceptance criteria state that examples alone are not sufficient for
money, and ADR-0005 already records property tests as a deliverable. An option
that produces no property tests cannot rank first here whatever it totals. I am
leaving the number visible rather than tuning it away, because the inflation is
a property of the scale and pretending otherwise would be the dishonest fix.

**4. Hand-rolled seeded generators.** The real cost is shrinking, which we would
be writing ourselves and which is what makes a failure readable; plus composable
cart and catalog generators for the checkout area later. Scores well on
reversibility only because it is our own code in our own test files. Ranked last
because it delivers the weakest version of the thing while costing the most to
maintain, in the money path.

## What the implementer does

Exact, so nothing here is re-decided downstream.

**Package:** `fast-check`, version `4.9.0` — MIT, one runtime dependency
(`pure-rand@^8`), ESM.

**Catalog pin.** Add to the **root** `package.json` `catalog` block, matching
how `vite-plus` is pinned there (exact version, no range):

```json
"catalog": {
  "vite": "npm:@voidzero-dev/vite-plus-core@0.2.5",
  "vite-plus": "0.2.5",
  "fast-check": "4.9.0"
}
```

**Workspace.** `packages/schemas/package.json`, in **`devDependencies`** —
never `dependencies`:

```json
"fast-check": "catalog:"
```

Later areas (`catalog`, `checkout`, `drawer-sessions`, `reporting`) add the same
`"fast-check": "catalog:"` line to their own `devDependencies`. The catalog pin
means one version across the repository, bumped in one place.

**Do not add `vitest` as a dependency of any workspace.** Tests keep importing
`describe` / `it` / `expect` from `vite-plus/test`, per issue 01.

**Test shape:**

```ts
import { describe, expect, it } from "vite-plus/test";
import fc from "fast-check";
```

with properties asserted as `fc.assert(fc.property(...arbitraries, (x) => { ... }))`
inside an ordinary `it()`.

**Which generators — this is the ADR-0005 rule:**

- `Centavos`, if represented as a safe-integer `number` → `fc.integer({ min, max })`
- `Millicentavos`, if represented as `bigint` → `fc.bigInt({ min, max })`
- per-mille multiplier → `fc.integer({ min: 1, max: 10000 })` (catalog's bound
  `0 < m ≤ 10`, encoded per-mille)
- VAT rate → the integer arbitrary matching whatever integer encoding issue 02
  chooses for the rate

Issue 02 chooses whether `Millicentavos` is a `bigint` or a safe-integer
`number`; no spec fixes that yet. The generator follows that choice — integer
arbitrary for `number`, bigint arbitrary for `bigint`.

- **Banned: `fc.float()`, `fc.double()`, and any `.map()` step that divides.**
  This is not caution for its own sake: fast-check issue #2086 documents
  `fc.double()` and `fc.float()` producing values *outside* their declared
  bounds because of floating-point precision. Using either in this repository
  is a review finding.
- **`fast-check` must never be imported outside `tests/**`, and no exported
  type in `packages/schemas/src` may reference a `fast-check` type.** This
  single rule is what keeps the reversal cheap; without it the reversibility
  score below is wrong.

**Number of generated cases:** leave the default of 100. Do not set a global
override. Revisit only if a real defect is found that 100 runs missed.

**Seeding:** leave the default, which picks a fresh seed each run. Do not pin a
global seed. Two reasons. A pinned seed tests the same 100 cases forever, which
is examples with extra steps. And the usual objection — a randomly-seeded test
turning the gate red on an unrelated commit — is blunted here, because the root
config sets `run.cache: true`, so a workspace's tests only re-execute when that
workspace's own inputs change. A red property test in `packages/schemas` is
therefore attributable to a change in `packages/schemas`.

**When a property fails, pin the regression — do not just re-run.** fast-check
prints a seed, a path, and the shrunk counterexample. Reproduce it while
debugging with `fc.assert(prop, { seed, path, endOnFailure: true })`. But what
gets **committed** is the shrunk counterexample rewritten as a plain example
test with the correct expected value, kept permanently beside the property. A
seed only reproduces against the same `fast-check` version; an example survives
upgrades. Re-running until green is the failure mode this whole record exists to
prevent.

## How to turn it back

Cheap by construction, and the reason is worth stating: this never enters
product code, never enters a migration, and never enters a shipped bundle. The
worst case is mechanical rewriting of test bodies.

1. Write a superseding record naming the replacement; flip this record's
   `Status:` to `overturned` with the date and reason, and update both lines in
   `LOG.md`.
2. Count the real cost first:
   `rg -l 'from "fast-check"' --glob '**/tests/**'`. Every hit is a file to
   rewrite. Today that number is zero; after `catalog`, `checkout`,
   `drawer-sessions`, and `reporting` have written their money properties it
   will be the bulk of the money test suite, and **that count is the reversal
   cost — it only grows.**
3. Remove `"fast-check": "catalog:"` from each workspace's `devDependencies`
   and the `fast-check` line from the root `catalog`, then `vp install` and
   commit the regenerated `bun.lock`.
4. Rewrite each `fc.assert(fc.property(...))` block into whatever replaces it.
   This is the actual work.
5. Run the gate: `vp check; vp run -r check; vp run -r test`.

No product file changes. No schema or migration changes. Nothing to redeploy.
Because the import is confined to `tests/**` and no exported type may mention a
`fast-check` type, step 4 can never turn into a change to a public interface —
which is precisely why reversibility scored 4 rather than 1. **If that
confinement rule is ever broken, this reversal estimate is void.**

## What would make this decision wrong

- `fast-check` stalls. It has effectively one maintainer (Nicolas Dubien).
  Trigger to revisit: no release for twelve months **and** an unpatched security
  advisory. As of 2026-08-01 there are zero published advisories and the last
  commit was 2026-07-30.
- The property suite becomes the slow part of a gate that has no hosted CI and
  is felt by whoever runs it. Trigger: `packages/schemas`'s test task exceeding
  roughly five seconds cold.
- Someone reports a property test going red and green across runs on unchanged
  code. That would falsify the caching argument above and would force the
  seeding policy — not necessarily the library — to be reopened.
- Vite+ begins exposing Vitest as a normal shared dependency. That removes the
  main objection to `@fast-check/vitest` and makes option 2 worth re-scoring,
  though ergonomics alone would still be a weak reason to move.

## Evidence

Accessed 2026-08-01.

Repository:

- `.scratch/foundation/issues/02-money-primitives.md` — the property-test
  acceptance criterion.
- `.scratch/foundation/PRD.md` lines 318–324 — "pure functions with no I/O";
  "Examples alone are not sufficient for money."
- `.scratch/checkout/PRD.md` lines 564–570, 676–682 — properties "over generated
  catalogs and carts", which is what makes composable generators a later
  requirement rather than a hypothetical.
- `docs/adr/0005-money-and-order-immutability.md` — floats prohibited in every
  layer; property tests named as a deliverable.
- `docs/adr/0006-forward-only-expand-contract-migrations.md` and
  `.orc2/config.env` line 14 — no hosted CI; `ORC2_GATE="vp check; vp run -r check; vp run -r test"`.
- `docs/adr/0001-stack-and-monorepo-shape.md` — Vite+ on the critical path for
  every command; catalog pinning as the versioning mechanism.
- `.scratch/foundation/issues/01-monorepo-skeleton-and-gate.md`, implementer
  report — tests import from `vite-plus/test`, "avoids adding `vitest` as a
  second, redundant devDependency".
- `packages/schemas/package.json` — current `devDependencies`; no test-tool
  dependency beyond `vite-plus`.
- `vite.config.ts` — `run: { cache: true }`, the basis of the seeding argument.
- `node_modules/.bun/vite-plus@0.2.5+343e86fcd41f620b/node_modules/vite-plus/package.json`
  line 369 — `"vitest": "4.1.10"` sits in vite-plus's own `dependencies`, exact-pinned.
- Verified absent: no top-level `node_modules/vitest`, and no `fast-check` or
  `pure-rand` anywhere in `node_modules`. This is what establishes both that
  rung 5 of the ladder fails (nothing installed already does this) and that
  `@fast-check/vitest` would have no shared runner copy to bind to.

External, primary sources:

- <https://registry.npmjs.org/fast-check/latest> — `4.9.0`, `"license":"MIT"`,
  `"dependencies":{"pure-rand":"^8.0.0"}`, `"type":"module"`,
  `"engines":{"node":">=12.17.0"}`, unpacked size 1,434,269 bytes.
- <https://registry.npmjs.org/@fast-check/vitest/> — latest `0.4.1`, published
  2026-04-28; `peerDependencies` `"vitest": "^4.1.0"`; depends on
  `fast-check "^3.0.0 || ^4.0.0"`; MIT; same maintainer and monorepo.
- <https://github.com/dubzzz/fast-check/security/advisories> — no published
  advisories. Same for the vitest package.
- <https://github.com/dubzzz/fast-check/commits/main> — last commit 2026-07-30.
- <https://raw.githubusercontent.com/dubzzz/fast-check/main/packages/fast-check/src/random/generator/Random.ts>
  — `nextInt` returns `uniformInt(...)` and `nextBigInt` returns
  `uniformBigInt(...)`; `nextDouble()` is a **separate** method. This is the
  line that answers the ADR-0005 question.
- `.../src/arbitrary/_internals/IntegerArbitrary.ts` — generates via
  `mrng.nextInt(min, max)`; validates with `safeNumberIsInteger`.
- <https://github.com/dubzzz/pure-rand/blob/main/README.md> — `uniformFloat32`
  and `uniformFloat64` are separate opt-in imports; the README calls out
  `rand() % numValues` as the biased naive approach the uniform distributions
  avoid.
- <https://github.com/dubzzz/fast-check/issues/2086> — `fc.double()` / `fc.float()`
  can emit values outside their declared bounds. The basis for banning them.
- <https://fast-check.dev/docs/tutorials/quick-start/read-test-reports/> — seed,
  path, `endOnFailure`, automatic shrinking.
- <https://fast-check.dev/docs/configuration/global-settings/> — default 100
  runs; default seed derived from the current time.
- <https://fast-check.dev> — runner-agnostic, "can be used within any test
  runner without any specific integration needed".

**Searched for and not found, where the absence mattered:**

- No PRD, ADR, or prior decision record names any property-testing library or
  any seeding policy — so this record is not re-deciding one, and there was no
  incumbent to score.
- The sibling reference project `../Fashio` has no property-testing dependency
  of any kind, so there was no working precedent to copy. This is the one place
  the usual "copy Fashio" argument from ADR-0001 gives no answer.
- I could not read the body of pure-rand's uniform-integer distribution; the
  raw source URLs returned 404. What is established is the call chain
  (`fc.integer` → `IntegerArbitrary` → `nextInt` → `uniformInt`) and that all
  fractional generation lives behind separately-named functions. I am recording
  this gap rather than implying I read code I did not. It does not change the
  decision: a fractional value can only reach a test through the banned APIs,
  and fast-check validates integer arbitraries with `Number.isInteger` at both
  the boundary and the shrink path.
