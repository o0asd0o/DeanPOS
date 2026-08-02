# 028: Passwords are hashed with `node:crypto`'s scrypt, because the only argon2 this project can reach is one of its two runtimes short — and `Bun.password` must be amended out of issue 02

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** `.scratch/tenancy-identity/issues/02-platform-admin-tenant-provisioning.md` ("Blocker 1" under `## Comments`), routed by the human

## The question

Issue 02 says passwords are hashed with `Bun.password`, Bun's built-in argon2id, and that
no new package may be added to do it. But the project's tests do not run on Bun — they run
on Node, where `Bun` does not exist. So every test that hashes a password crashes, and the
one function in the product that protects a restaurant owner's account is the one function
nothing checks.

What does DeanPOS hash passwords with?

A wrong answer costs one of two things, and they pull in opposite directions. Pick
something the tests cannot run and the situation does not change: a security function ships
unverified. Pick something production cannot run and it is worse — the tests go green and
the live server throws the first time anybody is provisioned.

## What I chose, and why

**`hashPassword` and `verifyPassword` are rewritten on `node:crypto`'s `scrypt`, which
both runtimes implement, and they store a self-describing hash string. No package is added.
`Bun.password` and the `Bun` global leave the backend entirely, and a grep test keeps them
out. Issue 02's acceptance criterion must be amended by the human, because it names
`Bun.password` by name and an implementer may not change a criterion on its own.**

Five things carry this, and the second is the one that decides it.

### 1. The real defect is not "Bun is missing in tests" — it is that the shipped code is not the tested code

`docker/api.Dockerfile` ends `CMD ["bun", "run", "apps/api/src/index.ts"]`, and record 012
runs development on Bun too. Production is Bun. So `Bun.password` is not broken in
production; it is only invisible to every test the project has.

That framing matters, because it rules out the tempting shortcut of hashing one way in
production and another way in tests. A password function whose production branch is never
executed by a test is the original defect wearing a hat, and it is a no-go below. What is
needed is not "something that works in tests". It is **one implementation that runs
unchanged on both runtimes**, so that what the gate proves is what the server does.

### 2. `node:crypto`'s argon2 — the implementer's own preferred alternative — throws on Bun

This is the finding that settles the question, and it is the opposite of what the issue's
Comments assume. The implementer confirmed `crypto.argon2`/`argon2Sync` are "present and
zero-dependency" in the Node the test runner uses, and they are: they landed in Node
v24.7.0 and were promoted to Stable in v26.4.0.

But in Bun 1.3.x — the runtime the product actually ships on — the same two names are
present and **throw when called**. From Bun's own source, `src/js/node/crypto.ts`:

```js
crypto_exports.argon2 = function argon2(_algorithm, _parameters, _callback) {
  throw $ERR_CRYPTO_ARGON2_NOT_SUPPORTED("Argon2 algorithm not supported");
};
```

The stated cause is structural rather than a missing weekend of work: Bun's crypto is
BoringSSL, and BoringSSL has no Argon2 KDF. An open issue tracks it
([oven-sh/bun#26585](https://github.com/oven-sh/bun/issues/26585)) with no resolution.

So the option that looked like rung 3 of the ladder — "the standard library does it" — is
in fact the **exact mirror of the bug being fixed**: green tests, a production server that
throws on the first provisioning call. It is worse than what is committed today, because
today the failure is loud in CI and afterwards it would be silent until a customer is
onboarded. Recorded prominently because it is the answer a reasonable person reaches for
first, and because Bun's own auto-generated reference page for `crypto.argon2` shows a full
signature with no warning at all. **On this question, Bun's reference pages are not
evidence; its source is.**

That leaves argon2id available only through a new package, which the ladder reaches only
after the standard library has genuinely failed.

### 3. The standard library has not failed — scrypt is on both runtimes, and OWASP names this exact situation

`crypto.scrypt`/`scryptSync` have been in Node since v10.5.0 under the crypto module's
"Stability: 2 - Stable", and Bun implements them: Bun's Node.js compatibility table lists
`node:crypto` as missing only `secureHeapUsed`, `setEngine` and `setFips`. Unlike argon2,
scrypt long predates that table, so its absence from the missing list is real information
rather than an artefact of the table being out of date.

And OWASP's Password Storage Cheat Sheet does not treat this as a compromise to be
apologised for. It sets the condition and the parameters:

> "scrypt should be used when the former [Argon2id] is not available."
> "N=2^17 (128 MiB), r=8, p=1"

The condition is met here in a stronger sense than OWASP probably imagined — argon2id is
not unavailable in some abstract sense, it is unavailable *as something this project can
execute in both the places it runs* without taking on a dependency whose support for the
production runtime no source states.

So the decision is not "argon2id or scrypt on the merits". Argon2id is better on the merits
and this record does not pretend otherwise. The decision is **an untestable argon2id, or an
unverified-on-Bun argon2id package, or a tested scrypt that both runtimes definitely run** —
and on a security primitive, the tested one wins.

### 4. What the stored hash looks like, and why that is the part worth being careful about

`node:crypto` gives a raw key-derivation function, not a password helper: no salt
generation, no output format. That is a real cost and it is the same cost `crypto.argon2`
would have carried, so it does not separate the two — but it does have to be done right.

The stored string follows the PHC string format's grammar, quoted from its spec:

> `$<id>[$v=<version>][$<param>=<value>(,<param>=<value>)*][$<salt>[$<hash>]]`
> "The B64 encoding is the standard Base64 encoding (RFC 4648, section 4) except that the
> padding `=` signs are omitted"

giving

```
$scrypt$ln=17,r=8,p=1$<16 random bytes, unpadded base64>$<32 byte key, unpadded base64>
```

Three properties come out of that, and they are why the format matters more than the
library:

- **The parameters travel with the hash.** Verification recomputes with the parameters read
  out of the *stored* string, never with the module's current constants. So OWASP's numbers
  can be raised later and every existing row still verifies — a parameter bump stops being a
  migration.
- **The algorithm id travels with the hash.** Moving to argon2id later is a branch on the
  `$scrypt$` prefix in one function, not a schema change and not a forced password reset.
- **It is the same shape `Bun.password` already produced**, which is what keeps the door
  open in both directions: Bun documents that its `verify` "detects the algorithm from the
  input hash, whether PHC- or MCF-encoded".

Three implementation facts, each of which is a real way to get this wrong, and each of
which the fixer needs in front of them rather than discovering:

- **`maxmem` must be set explicitly or the chosen parameters throw.** Node's default is
  `32 * 1024 * 1024`, and "the error is thrown if `128 * N * r > maxmem`". At N=2^17, r=8
  that is 128 MiB, four times the default. Write it as `maxmem: 128 * N * r * 2` so it
  cannot drift out of step with the parameters above it.
- **Comparison is `crypto.timingSafeEqual`, never `===`.** It "is done in constant time to
  avoid leaking information through timing side-channels", and a length mismatch must be
  handled before the call rather than by letting it throw.
- **The salt is `randomBytes(16)`**, from the same module. Nothing about the user goes into
  it.

The sketch, so that "hand-rolled" means transcription rather than design:

```ts
const PARAMS = { ln: 17, r: 8, p: 1, keyLength: 32, saltBytes: 16 };
const b64 = (b: Buffer) => b.toString("base64").replace(/=+$/, "");
const derive = (password: string, salt: Buffer, ln: number, r: number, p: number) =>
  scryptSync(password, salt, PARAMS.keyLength, { N: 2 ** ln, r, p, maxmem: 128 * 2 ** ln * r * 2 });
```

`hashPassword` generates a salt, derives, and joins the five `$`-separated fields.
`verifyPassword` splits on `$`, refuses anything whose id is not `scrypt`, parses
`ln`/`r`/`p`, re-derives with **those** values, and returns `timingSafeEqual`. Roughly
thirty lines in the one file that already exists.

**And it is pinned by a known-answer test, not only by a round-trip.** A round-trip test
proves an encoder agrees with itself; it passes just as happily over a broken KDF. RFC 7914,
"The scrypt Password-Based Key Derivation Function", publishes vectors in §12 ("Test Vectors
for scrypt"), the first being `P="", S="", N=16, r=1, p=1, dkLen=64`. One test transcribing
those vectors from the RFC — *from the RFC, not from memory or from a blog* — is what turns
"the primitive works" from an assumption into a check. This is the point where the standing
rule that "close enough" is not enough for a security path is actually spent.

### 5. The class of bug gets closed, not just this instance

`Bun.password` is not special. Any `Bun.*` global in shared backend code produces exactly
this failure: a green `vp check` (because a hand-written ambient declaration satisfies the
type checker, which is precisely what `packages/backend/src/common/bun-password.d.ts` was
added to do) and a red or, worse, absent test. Issue 03's sessions and issue 10's PIN
hashing are both in a position to repeat it.

So a rule, and the cheapest possible enforcement of it:

> **No `Bun` global in `packages/backend/src` or `apps/api/src`.** The backend uses only
> APIs both runtimes implement.

Enforced by one grep test in the shape the repository already uses twice
(`apps/api/tests/tenant-isolation-grep.test.ts`,
`apps/api/tests/platform-admin-no-password-logging-grep.test.ts`) — rung 2 of the ladder, not
a new mechanism. It costs nothing today, because
`rg '\bBun\.' apps packages --glob '*.{ts,tsx}'` returns **two files and both are being
deleted or rewritten by this record**. Pre-decided so nobody has to route back: if a future
entry point genuinely needs `Bun.serve`, the allow-list is `apps/api/src/index.ts` and
`apps/api/src/dev.ts` and nothing else — those are files a container runs and a test never
imports.

### What I considered and am not doing

**Making the test runner Bun.** This is the option that would have kept `Bun.password` and
it is the honest ideal — the production primitive, tested as itself. It is ranked, not
dismissed. It loses because nothing establishes it is reachable: `vp test` runs vitest under
vite-plus's own privately bundled Node (`~/.vite-plus`), there is no project-level `vitest`
binary for `bun run --bun vitest` to find, and no primary source documents a vite-plus option
to select a runtime. Vitest's own guide mentions Bun only to warn that `bun test` hijacks the
command, which is about a package-manager collision and not about vite-plus at all. And the
blast radius is the wrong shape: nine workspaces, happy-dom, and records 008 and 015's
environment decisions would all move to fix one function.

**Choosing an argon2id package anyway.** `hash-wasm` is the strongest candidate and the
named successor below — MIT, zero dependencies, pure WebAssembly, ~1.1M weekly downloads, an
`outputType: 'encoded'` that emits the PHC string directly, and Bun documents WebAssembly as
"🟢 Fully implemented". It still loses today on the criterion that the whole question is
about: **no source, including its own README, states that it runs on Bun.** Adopting a
dependency of unverified portability to cure a primitive of proven non-portability is not
obviously forward motion, and I cannot execute Bun to check. Its maintenance signal is also
thin for a security primitive — last commit 2024-11-19, effectively one maintainer — though
no advisory exists against it. The two native candidates lose harder: `@node-rs/argon2` rests
on Bun's N-API, which Bun describes as "most existing Node-API extensions work" rather than
all, and `argon2` (ranisalt) adds node-gyp, 3.7 MB and three dependencies to an
`oven/bun:1.3.13-slim` image build.

### Weights used for the ranking

Declared before any option was written down, and **not changed afterwards**.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×1 | Every viable option protects the password. They differ in how confident anyone can be that it is running, not in what the account owner gets. Manufacturing a spread here would be dishonest. |
| Business impact | ×1 | All are free, none changes what can be sold, and none is visible to a customer. |
| Engineering cost and risk | ×3 | Every fact that separates the options is one: does it execute on both runtimes, does it need a native build inside the production image, does it need encoding written by hand, how much of the toolchain moves. |
| Reversibility | ×2 | The artefact is a hash format stored in a database column, which is the classic expensive-later decision. Scored explicitly because it is why the question was routed here. |
| Evidence strength | ×2 | The blocker exists because a runtime fact was assumed rather than checked, and the leading candidate is refuted by a single line of source. Claims here have to be quoted. |

Maximum possible total: 45. Same shape as records 011, 027 and 029.

## The options, ranked

| Rank | Option | User | Business | Eng cost/risk ×3 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ---- | -------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **`node:crypto` scrypt, PHC-shaped self-describing string, no dependency** | 4 | 4 | 5 (15) | 5 (10) | 5 (10) | **43** |
| 2 | `hash-wasm` argon2id (new dependency, pure WASM) | 5 | 4 | 3 (9) | 4 (8) | 3 (6) | **32** |
| 3 | `@node-rs/argon2` (new dependency, native N-API) | 5 | 4 | 2 (6) | 4 (8) | 3 (6) | **29** |
| 4 | `argon2`, ranisalt (new dependency, node-gyp) | 5 | 4 | 1 (3) | 4 (8) | 3 (6) | **26** |
| 5 | Make the test runner Bun; keep `Bun.password` | 5 | 4 | 1 (3) | 2 (4) | 2 (4) | **20** |
| 6 | Do nothing — ship provisioning with the hash untested, defer to issue 03 | 1 | 1 | 2 (6) | 5 (10) | 1 (2) | **20** |
| 7 | `node:crypto` argon2 (Node 24's built-in) | 1 | 1 | 1 (3) | 3 (6) | 1 (2) | **13** |

**1 — `node:crypto` scrypt, chosen.** The only option that is certain on both runtimes,
adds nothing to the lockfile or the image, keeps issue 02's "no new dependency" promise
literally true, and can be pinned to published test vectors. Engineering cost 5 because the
entire artefact is one existing file plus one grep test, with no manifest, lockfile or
Dockerfile touched. Evidence 5 because every load-bearing claim is a quoted line from Node's
docs, Bun's source or compatibility table, OWASP, the PHC spec or RFC 7914 — including the
two that could have sunk it, `maxmem` and `timingSafeEqual`. User impact is 4 rather than 5:
argon2id is the better algorithm and this is a documented step down from it, taken on
OWASP's own stated condition.

**2 — `hash-wasm`.** The named successor and the thing to move to. It is the only candidate
that gets real argon2id with no native build, no platform binaries and no build toolchain,
and its `encoded` output removes the hand-written encoding — the one genuine weakness of
option 1. It ranks second, eleven points back, entirely on the ×3 and evidence criteria: its
Bun support is *inferred* from Bun implementing WebAssembly rather than *stated* by anyone,
and its last commit is roughly twenty-one months old with effectively a single maintainer.
Neither is disqualifying; both are exactly the facts that should be re-checked at the trigger
below. **Named trigger: anyone able to execute `hash-wasm`'s argon2id under Bun 1.3 and Node
24 and show the same PHC string out of both.** At that point option 2 becomes the better
answer and the move costs one file.

**3 — `@node-rs/argon2`.** Smaller and faster than its native rival (476 KB against 3.7 MB
by its own comparison), actively maintained, MIT, no advisories. It loses because it makes
production depend on Bun's N-API implementation, which Bun describes as covering "most
existing Node-API extensions" — an unquantified "most" standing between a customer and a
working sign-in. It also puts eight-plus per-platform optional packages into a lockfile that
`bun install --frozen-lockfile` resolves inside the image build.

**4 — `argon2` (ranisalt).** The most-used and most conventional choice, and the worst fit
for this repository. node-gyp with prebuilds means the production image either finds a
prebuild for its exact platform or needs a C toolchain in `oven/bun:1.3.13-slim`, and it
brings three direct dependencies including `@phc/format`, whose own last release was 2020.
Engineering cost 1 is about the image, not the library.

**5 — Make the test runner Bun.** The philosophically right answer, ranked fifth because
nothing establishes it can be done. Two unknowns stack: whether vite-plus can select a
runtime at all, and whether the eight other workspaces' tests survive it. Reversibility 2
because a toolchain change touches root configuration and every workspace's gate, which is
not a one-commit revert. If vite-plus ever documents a runtime flag, this option deserves
re-scoring on its own record — and it would still not, by itself, be a reason to keep a
runtime-specific global in shared code.

**6 — Do nothing.** Included because it must be. **10 of its 20 points are reversibility**,
which every do-nothing option maximises trivially — the same inflation records 002, 007, 008,
011, 015 and 027 each left visible rather than tuning away. It is refuted by what it actually
means: issue 02 merges with four red tests and a password function that has never once
executed under test, on the issue that creates every restaurant's first administrator account.

**7 — `node:crypto` argon2.** Ranked last and kept in the table on purpose, because it is
the option the issue's own Comments lean toward and the one a reader will reach for. It
throws on the production runtime. Evidence 1 because the research refutes it outright; user
and business 1 because the product does not work.

**Is it close?** Between options 1 and 2, closer than eleven points suggests. Strip the ×3
weighting and it is 21 to 19. What the weighting encodes is a genuine judgement rather than a
thumb on the scale: this whole blocker exists because a runtime assumption went unchecked, so
"does it demonstrably run where it has to run" is worth more here than it usually is. If the
trigger above fires, option 2 should win. Between 1 and everything else it is not close.

## What issue 02 must change

**Five files, and one of them is an issue file the human must edit.**

**1. `packages/backend/src/common/password.ts` — rewritten.** `PASSWORD_HASH_PARAMS`
becomes the scrypt parameters (`ln: 17, r: 8, p: 1`, 32-byte key, 16-byte salt), still
declared in one place, still separate from issue 10's PIN parameters. `hashPassword` and
`verifyPassword` keep their exact signatures — `(string) => Promise<string>` and
`(string, string) => Promise<boolean>` — so nothing that imports them changes. Follow the
sketch and the three implementation facts above.

**2. `packages/backend/src/common/bun-password.d.ts` — deleted.** It exists only to make
`Bun.password` typecheck, and it is the reason `vp check` stayed green while `vp test` was
red. Removing it is what stops a green gate from being able to hide this class of bug again.

**3. `packages/backend/src/common/password.test.ts` — two changes.** The
`/^\$argon2id\$/` assertion becomes `/^\$scrypt\$/`, and **a known-answer test is added**
transcribing at least the first two vectors from RFC 7914 §12 against a raw `scryptSync`
call. The existing round-trip, wrong-password and no-plaintext tests stand unchanged. Worth
adding while in the file, because it is the property the format was chosen for: a hash
string whose stored `ln` differs from the module's current constant still verifies.

**4. `apps/api/tests/platform-admin-provision-tenant.test.ts` line 83** —
`expect(users[0]?.password_hash).toMatch(/^\$argon2id\$/)` becomes `/^\$scrypt\$/`. That is
the only line in that file this record touches.

**5. New `apps/api/tests/runtime-portability-grep.test.ts`** — copy the structure of
`platform-admin-no-password-logging-grep.test.ts`, scan `packages/backend/src` and
`apps/api/src`, and assert no file contains a `Bun.` member access outside a comment. No
allow-list today.

**Nothing else changes.** Not `provision-tenant.ts`, not the schema, not the migration, not
`client.ts`, not a manifest, not `bun.lock`, not a Dockerfile.

### What the human must change, because an implementer may not

Issue 02 states `Bun.password` in prose and in an acceptance criterion. Both are now wrong
and neither can be edited by the lane.

**In `## What to build`, lines 16–19**, replace the `Bun.password` sentence with:

> Password hashing arrives here because provisioning is the first thing that needs it:
> `node:crypto`'s scrypt at OWASP's parameters, no new dependency, parameters configured in
> one place — see `.scratch/decisions/028`. PIN hashing gets its own parameters later (issue
> 10) — the two are configured separately, because the PIN's hash ends up sitting on a
> tablet.

**Replace the fourth acceptance criterion** with:

> - [ ] Password hashing runs from one implementation on both the production runtime and the
>       test runtime, with parameters declared in one place, storing a self-describing hash
>       string; the round-trip **and a published known-answer vector** are tested **directly,
>       not through the seam** — it is a pure function over a hashing primitive.

**No other issue's acceptance criteria change, and no merged code is touched.** Issue 01 is
entirely unaffected by this record.

## No-gos

- **No branch on the runtime, ever** — no `typeof Bun !== "undefined"`, no dual
  implementation, no polyfill chosen at import time. A production path a test never executes
  is the defect this record exists to remove, and reintroducing it as a conditional is the
  same bug with better manners.
- **No `crypto.argon2` in this repository while Bun is the production runtime.** It throws.
- **No verification against the module's current parameters.** Always the parameters parsed
  out of the stored string, or a routine parameter bump becomes a mass lockout.
- **No `===` or `==` on a derived key.** `timingSafeEqual`, with the length checked first.
- **No password, hash or salt in a log**, which the existing grep test already enforces over
  this file.
- **No hashing in the database** — `pgcrypto`'s `crypt()` would put plaintext into SQL, which
  PostgreSQL warns can reach the server log, the same trap record 027 named for `CREATE ROLE`.
- **No second hashing primitive for PINs in issue 10.** Different parameters in a different
  file, the same primitive, unless issue 10 writes its own record saying why not.

## How to turn it back

**Reversing this record**, i.e. going back to `Bun.password`: restore `password.ts` and
`bun-password.d.ts`, revert the two regex assertions, delete the grep test. One commit, five
files, **no database change** — there are zero password rows anywhere today, which is exactly
why this is being settled now and not after issue 03 ships sign-in. It also restores four
failing tests, so it is only a real reversal in combination with making the test runner Bun.

**Moving to argon2id later**, the likelier direction and the one the format was chosen for.
It is *additive* and needs no migration:

1. Add the package; rewrite `hashPassword` to emit `$argon2id$…`.
2. `verifyPassword` branches on the algorithm id it parses: `argon2id` → the new path,
   `scrypt` → the existing path.
3. On a successful `scrypt` verification, re-hash and store. That hook belongs on the
   sign-in path, which **issue 03 builds** — so the natural place for it exists before there
   is anything to migrate.
4. Delete the `scrypt` branch once no `$scrypt$` rows remain.

**The number that bounds both, re-checked before quoting it:**
`rg -l 'hashPassword|verifyPassword' --glob '!node_modules'` returns
`packages/backend/src/common/password.ts`,
`packages/backend/src/common/password.test.ts`, and
`packages/backend/src/platform-admin/handlers/provision-tenant.ts`. **One production call
site**, and because both signatures are `(string) => Promise<…>` with no library type in
them, the module already *is* the adapter — the reversal cost cannot grow past the number of
places that hash or verify a password, however many packages are swapped underneath.

**What will have been built on top of it by then.** Issue 03's sign-in, issue 10's PIN
module (a sibling file, not a shared knob), and every stored hash. The stored hashes are the
only irreversible part, and self-describing strings plus a rehash-on-verify branch are what
make even those cheap.

## What would make this decision wrong

- **Someone shows `hash-wasm`'s argon2id producing the same PHC string under Bun 1.3 and
  Node 24.** Then the reason to prefer the standard library evaporates and option 2 is
  better. **This is the trigger to watch**, and it is a fifteen-minute check, not a project.
- **Bun ships `crypto.argon2`.** oven-sh/bun#26585 is open; BoringSSL is the stated
  obstacle, so this is not imminent. If it lands, options 1, 2 and 7 collapse into one and
  this record is superseded by a much simpler one.
- **`node:crypto` scrypt turns out not to work on Bun 1.3.13.** The compatibility table says
  it does and the argon2 finding proves those pages can mislead — the reference page for
  `crypto.argon2` shows a clean signature for a function that throws. **The compatibility
  table is different evidence from the reference page, and it is what this rests on**, but
  the asymmetry is real, so the fixer must execute `hashPassword`/`verifyPassword` once under
  `bun` before closing the issue. `bun` is already installed on this machine as the package
  manager. If it fails, option 2 is the immediate fallback and no other part of this record
  changes.
- **128 MiB per hash becomes an operational problem.** At OWASP's N=2^17 each concurrent
  hash allocates 128 MiB, which is invisible on a provisioning path called once per
  restaurant and is not invisible on issue 03's sign-in path on a small VPS. **Re-check
  trigger: issue 03.** The fix is one of OWASP's own equivalent lower-memory configurations,
  not an invented number, and because the parameters travel in the hash string, changing them
  locks nobody out.
- **A later area needs to hash in the browser or on the tablet** — issue 10's PIN, if the
  hash is ever computed device-side rather than server-side. `node:crypto` is not available
  there, and that is a genuinely different question needing its own record; `hash-wasm` would
  be the leading candidate for it, which is a second reason to keep option 2 warm.
- **`vp` changes its bundled runtime.** The rule in section 5 is what makes that a
  non-event, which is the main reason the rule is worth the grep test.

## Evidence

**Repository, read 2026-08-02**, in the lane worktree
`/Users/jomelortega/Desktop/personals/PremiumSoftwares/DeanPOS/.worktrees/ti02-platform-admin-tenant-provisioning`
(branch `ti02-platform-admin-tenant-provisioning`, commit `bac0f86`, committed deliberately
red):

- `packages/backend/src/common/password.ts` — the four-line module this record rewrites, and
  its `memoryCost: 19456 // OWASP minimum for argon2id` comment, which shows the OWASP figures
  were already the intended source.
- `packages/backend/src/common/bun-password.d.ts` — **the file that explains why `vp check`
  is green and `vp test` is red.** A hand-written ambient declaration satisfies the type
  checker for a global that does not exist at run time.
- `packages/backend/src/common/password.test.ts` — the four tests, including the
  `/^\$argon2id\$/` assertion that must move.
- `apps/api/tests/platform-admin-provision-tenant.test.ts` line 83 — the second
  `argon2id` assertion. Its other five tests are untouched by this record.
- `packages/backend/src/platform-admin/handlers/provision-tenant.ts` line 34 — the **single
  production call site** of `hashPassword`, and the reason the reversal cost is one file.
- **`docker/api.Dockerfile`** — `FROM oven/bun:1.3.13-slim` and
  `CMD ["bun", "run", "apps/api/src/index.ts"]`. **This is the file that makes "production is
  Bun" a fact rather than an assumption, and therefore the file that eliminates
  `node:crypto` argon2.**
- `package.json` — `devEngines.packageManager` bun 1.3.13; `engines.node: ">=22.18.0"`, which
  Node 24's argon2 would have contradicted independently; the catalog, which gains nothing.
- `bun.lock` — searched for `argon2`, `hash-wasm`, `@node-rs`, `scrypt`, `bcrypt`:
  **no matches.** Rung 5 of the ladder is genuinely empty; nothing already installed hashes
  passwords.
- `apps/api/tests/tenant-isolation-grep.test.ts` and
  `apps/api/tests/platform-admin-no-password-logging-grep.test.ts` — the two existing grep
  tests the new one copies. Rung 2, not a new mechanism.
- `rg '\bBun\.' apps packages --glob '*.{ts,tsx}'` — **two files, `password.ts` and
  `bun-password.d.ts`.** The grep rule costs nothing to adopt.
- `.scratch/decisions/012-development-origins-and-the-dev-server.md` (development also runs
  the API under `bun run --hot`, so Node is the test runtime and only the test runtime),
  `.scratch/decisions/011-local-stack-and-versioned-deploy.md` (the Bun base image tied to
  `devEngines`, and the one deliberate second base image), `.scratch/decisions/016-…` (the
  privately bundled vite-plus toolchain at `~/.vite-plus`, which is why there is no
  project-level `vitest` binary for `bun run --bun vitest` to find),
  `.scratch/decisions/027-the-app-role-credential.md` (the "no plaintext secret where it can
  be logged" position this record extends to `pgcrypto`).
- `.scratch/decisions/` searched for an existing or orphaned record on password hashing,
  argon2, scrypt, or the test runtime before writing: records 001–027 exist and **none names a
  hashing algorithm or a runtime split. No duplicate.**

**External, primary sources, accessed 2026-08-02.** All pages were treated as data; none
contained anything addressed to an agent, and no instruction from any of them was acted on.

- **Bun source, `src/js/node/crypto.ts`** — `crypto_exports.argon2` and `argon2Sync` throw
  `$ERR_CRYPTO_ARGON2_NOT_SUPPORTED("Argon2 algorithm not supported")`, with BoringSSL named
  as the cause. Corroborated by <https://github.com/oven-sh/bun/issues/26585>, open, filed
  against Bun 1.3.8. **The single most important fact in this record.**
- Bun, Node.js API compatibility — <https://bun.com/docs/runtime/nodejs-apis> — `node:crypto`
  "🟡 Missing `secureHeapUsed` `setEngine` `setFips`"; `WebAssembly` "🟢 Fully implemented".
- Bun, Node-API — <https://bun.sh/docs/runtime/node-api> — "Bun implements this interface
  from scratch, so **most** existing Node-API extensions work with Bun out of the box."
- Bun, Hashing — <https://bun.com/docs/api/hashing> — "with `argon2` the result is encoded in
  the newer PHC format"; defaults `argon2id`, `m=65536,t=2`; "The `verify` function detects
  the algorithm from the input hash, whether PHC- or MCF-encoded."
- Node.js v24.7.0 release — <https://github.com/nodejs/node/releases/tag/v24.7.0> —
  "**(SEMVER-MINOR)** **crypto**: add argon2() and argon2Sync() methods"; PR
  <https://github.com/nodejs/node/pull/50353> whose doc diff adds
  "Stability: 1.2 - Release candidate", documents `argon2Sync` returning `{Buffer}` — **a raw
  key, not a PHC string** — and uses `nonce`/`memory`/`passes` rather than the reference
  library's names. Promoted to Stable in v26.4.0.
- Node.js v24 crypto docs — <https://nodejs.org/docs/latest-v24.x/api/crypto.html> —
  "Stability: 2 - Stable"; `crypto.scrypt` "Added in: v10.5.0"; defaults `cost`/`N` 16384,
  `blockSize`/`r` 8, `parallelization`/`p` 1, **`maxmem` 32 \* 1024 \* 1024**; "The error is
  thrown if `128 * N * r > maxmem`"; `timingSafeEqual` "comparison is done in constant time
  to avoid leaking information through timing side-channels."
- OWASP Password Storage Cheat Sheet —
  <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html> —
  argon2id "m=19456 (19 MiB), t=2, p=1"; "scrypt should be used when the former is not
  available"; "N=2^17 (128 MiB), r=8, p=1", with equivalent lower-memory configurations
  listed alongside.
- PHC string format — <https://github.com/C2SP/C2SP/blob/main/phc-strings.md> —
  `$<id>[$v=<version>][$<param>=<value>(,<param>=<value>)*][$<salt>[$<hash>]]`; "The B64
  encoding is the standard Base64 encoding (RFC 4648, section 4) except that the padding `=`
  signs are omitted."
- RFC 7914, "The scrypt Password-Based Key Derivation Function" —
  <https://www.rfc-editor.org/rfc/rfc7914.html> — §12 "Test Vectors for scrypt", first vector
  `P="", S="", N=16, r=1, p=1, dkLen=64`. **The vectors must be transcribed from here.**
- RFC 9106 — <https://www.rfc-editor.org/rfc/rfc9106.html> — defines the Argon2 algorithm and
  its test vectors and **contains no occurrence of "PHC" and no string encoding**. Worth
  recording because it corrects a natural assumption: the `$argon2id$v=19$…` string is the PHC
  format's, not the RFC's.
- Package survey, all accessed 2026-08-02: `hash-wasm@4.12.0` (MIT, 0 dependencies, pure
  WASM, ~1.11M weekly downloads, `outputType: 'encoded'` + `argon2Verify`, last commit
  2024-11-19, effectively one maintainer); `@node-rs/argon2@2.0.2` (MIT, per-platform NAPI
  binaries as optional dependencies, ~898K weekly, 476 KB vs node-argon2's 3.7 MB by its own
  comparison, last commit 2026-07-19); `argon2@0.45.1` (ranisalt, MIT, node-gyp, 3 direct
  dependencies including `@phc/format`, ~1.85M weekly, "PHC string formatting ✅", sole npm
  maintainer); `@phc/format@1.0.0` (MIT, 0 dependencies, **last published 2020-07-03**).
  GitHub Advisory Database queried for all four: **no advisories against any of them**; the
  only `argon2` hit is GHSA-3p6c-7qjr-35x9 against Perl's `Crypt::Argon2`.

**Searched for and not found, where the absence mattered:**

- **No primary source states that any of the four npm packages runs on Bun.** Not one README
  mentions Bun. For `hash-wasm` the inference from "Bun implements WebAssembly fully" is
  strong, but it is an inference, and it is the specific reason option 2 scores 3 on evidence
  rather than 5 — on a question that *is* about runtime portability, an unstated portability
  claim is the thing that must not be waved through.
- **No documented way for `vp test` to select a runtime.** Vitest's guide mentions Bun only
  as a `bun test` command-collision warning; nothing on Bun's or vite-plus's side describes
  running vitest under Bun in a repository with no project-level vitest binary. The
  implementer reached the same empty result independently. That absence is what puts option 5
  fifth.
- **Whether the PHC registry blesses `ln`/`r`/`p` as scrypt's parameter names could not be
  confirmed.** The grammar and the unpadded-base64 rule are quoted and verified; the specific
  scrypt parameter spelling follows the de-facto convention. Stated rather than hidden — it
  does not affect correctness, because this repository is the only producer and the only
  consumer of the string, but a future reader should not mistake it for a verified claim.
