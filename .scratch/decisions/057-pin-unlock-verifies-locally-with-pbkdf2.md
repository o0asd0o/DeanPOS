# 057: A PIN is hashed with PBKDF2-HMAC-SHA-256 and verified in the browser, because criterion 2's "same primitive as passwords" and criterion 4's offline unlock cannot both hold — and criterion 4 wins

- **Status:** decided
- **Stakes:** **high** — a new credential, a new hash column, a payload that ships credential material to a stealable tablet, and a claim shown to a cashier. Q1 is a credential-exposure decision and reads like one below.
- **Date:** 2026-08-03
- **Asked by:** the orchestrator, for `.scratch/tenancy-identity/issues/10-pin-unlock-and-the-hash-sync-payload.md` (criteria 1–9)
- **Relates to:** [028](028-password-hashing-runs-on-both-runtimes.md) (**this record is the exception 028's last no-go reserved, and 028's final "what would make this wrong" bullet predicted it by name**; 028 stays `decided`), [056](056-the-device-principal-its-token-and-its-two-screens.md) (Device principal, `localStorage` accessor, POS shell), [032](032-the-password-policy.md) (PINs excluded from the password policy), [033](033-throttling-sign-in.md)/[034](034-the-throttle-under-concurrency.md) (blocking KDFs), [042](042-user-event-is-refused-because-happy-dom-has-no-activation-behaviour.md) (no new dependency), [009](009-terminal-shell-chrome-states.md) (no state that cannot be true), [014](014-the-focus-indicator-colour.md)

## The questions

Six on one issue: **Q1** how a PIN is verified with no network; **Q2** the KDF parameters and their file; **Q3** the sync payload's procedure, shape and authorisation; **Q4** the unlock screen at 1280 and 390; **Q5** where the acting User lives and what Lock clears; **Q6** what "nothing logs a PIN or a PIN hash" is enforced by. A wrong answer costs three ways: a design that cannot be built at all (Q1 as the issue currently specifies it), a roster of grindable credentials on a stolen tablet, and a till that cannot sell during the outage the whole feature exists for.

## What was already decided, and is not revisited

- **ADR-0007:** *"PIN hashes at rest on the Device are a deliberate credential-exposure tradeoff, taken because offline unlock is a hard requirement. Mitigations: per-Store scope only, slow hash, PIN attempt throttling on-device."* It says **slow hash**, not scrypt — the ADR does not constrain Q1. *"A stolen enrolled Device is the primary threat."* Throttling and lockout are issue 11's.
- **032, verbatim:** *"Explicitly: none of the above applies to issue 10's PIN… The PIN's security is bought by throttling, not by length."*
- **056, inherited whole:** the `device` `Ctx` arm and `deviceCtx()`; no Device-token procedure accepts a `tenantId` or `storeId`; `localStorage` behind one accessor module per key-set; **a refused request never auto-clears local state**; the POS shell, `Card`, plain `<form>` + `useState` (no TanStack Form — 037 is back-office-scoped).
- **042 stands: no new third-party dependency.** A *workspace* dependency between existing packages is not one.
- **Money is integer centavos (ADR-0005); a PIN is a string everywhere and is never parsed to a number** (`"0042"` is not `42`).

### Weights, declared before any option was scored

**User ×2** (a till that cannot sell during an outage is the failure the feature exists to prevent) · **Business ×1** (nothing here earns; the one commercial fact is a stolen tablet's blast radius) · **Eng cost/risk ×2** · **Reversibility ×2** (a stored hash format and a synced payload shape are the classic expensive-later artefacts) · **Evidence ×3** (Q1 turns entirely on two checkable facts — what a browser can actually compute, and what a GPU costs — and the issue as written is refuted by the first). Maximum **50**. **Not changed after scoring.**

## Q1 — PBKDF2-HMAC-SHA-256, one algorithm in all three runtimes. Criterion 2 gives.

**The issue as written cannot be built, and this must be said plainly.** Record 028 put password hashing on `node:crypto`'s scrypt. `node:crypto` does not exist in a browser, and the Web Cryptography API **has no scrypt** — checked against the spec's own algorithm registry, which lists PBKDF2 (`deriveBits`, `deriveKey`, `importKey`) and no scrypt and no Argon2. So a terminal cannot verify a synced scrypt hash offline. **Criterion 2 and criterion 4 cannot both hold as written. Criterion 4 holds; criterion 2 is amended** — it names an implementation, criterion 4 names the product.

**The decision: one algorithm, computed by `globalThis.crypto.subtle` in every place — the API server, the test runner, and the browser.** No package is added: WebCrypto is native in browsers, native in Node (`globalThis.crypto`, stable since v15) and native in Bun. That is rung 4 of the ladder, not rung 6 — one implementation, executed by the gate, running in production, which is the whole point 028 was arguing.

| Step | Exact call |
| --- | --- |
| Derive | `crypto.subtle.importKey("raw", utf8(pin), "PBKDF2", false, ["deriveBits"])` then `deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256)` |
| Salt | `crypto.getRandomValues(new Uint8Array(16))` — the same global `apps/backoffice/src/features/users/helpers.ts:23` already uses |
| Store | `$pbkdf2-sha256$i=600000$<salt, unpadded base64>$<32-byte key, unpadded base64>` — **028's PHC-shaped grammar exactly**, so parameters and algorithm id travel with the hash |
| Verify | parse the stored string, re-derive with **those** parameters, compare with a constant-time loop over the two byte arrays (`timingSafeEqual` is `node:crypto` and is not reachable in a browser) |

**The honest security statement, with numbers, because this is the part that must not be soft.** A 4–6 digit PIN is 1,110,000 candidates. Scaling raw hashcat v6.2.6 output for a single RTX 4090 to each configuration's recommended work factor:

| Configuration | Benchmarked | Scaled | Exhaust 1,110,000 candidates |
| --- | --- | --- | --- |
| **PBKDF2-HMAC-SHA-256, 600,000 iters (chosen)** | 8,865.7 kH/s @ 999 | 14,762 H/s | **~75 s** |
| PBKDF2-HMAC-SHA-512, 220,000 iters | 3,120.9 kH/s @ 999 | 14,172 H/s | ~78 s |
| scrypt at a tablet-viable N=2^14 | 7,126 H/s @ N=16384 | 7,126 H/s | ~156 s |
| scrypt at OWASP's N=2^17 (128 MiB) | — | ~891 H/s | ~21 min |

**No KDF saves this PIN.** The best case in the table is twenty-one minutes on one rented GPU, and it is unreachable anyway: 128 MiB per derivation in a browser on a cheap Android tablet is not a latency budget, it is a crash. **Once scrypt is sized for the hardware it has to run on, it is within a factor of two of PBKDF2 — and that factor of two is what a new dependency would be buying.** It is not worth a dependency, and saying otherwise would be theatre.

So the PIN is not protected by its hash. It is protected by the rule the issue already states in bold: **a PIN is never accepted without a valid, unrevoked Device token.** Cracking the whole roster off a stolen tablet yields nothing the thief did not already hold — 056 put the Device token in `localStorage` on the same device — and an admin revoking the Device voids both. **The exposure ADR-0007 accepted is real, is now quantified rather than asserted, and its only genuine mitigation is revocation.**

| Rank | Option | User ×2 | Bus ×1 | Eng ×2 | Rev ×2 | Evid ×3 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **PBKDF2-HMAC-SHA-256 via WebCrypto, server and browser** | 5 (10) | 4 | 5 (10) | 4 (8) | 5 (15) | **47** |
| 2 | WASM scrypt in the browser (new dependency), criterion 2 kept literally | 4 (8) | 3 | 2 (4) | 4 (8) | 3 (9) | **32** |
| 3 | Two hashes: scrypt server-side, a second PBKDF2 hash synced to the tablet | 5 (10) | 3 | 2 (4) | 2 (4) | 3 (9) | **30** |
| 4 | Online-only unlock; hand criterion 4 to `offline-sync` | 1 (2) | 1 | 4 (8) | 5 (10) | 1 (3) | **24** |
| 5 | Hand-write scrypt in TypeScript | 4 (8) | 2 | 1 (2) | 4 (8) | 1 (3) | **23** |

**2 — WASM scrypt.** The only option that keeps criterion 2 literally true and needs no human edit, and the honest runner-up. `hash-wasm` is the candidate 028 already surveyed (MIT, zero dependencies, pure WASM — but last commit 2024-11-19 and effectively one maintainer). It loses on the table above: retuned for a tablet it buys ~2× against an attacker who needs minutes either way, in exchange for a security primitive from a stale single-maintainer package that would also have to work inside `offline-sync`'s service worker. **Reversal cost if it is ever wanted: one file** (`packages/contract/src/pin.ts`) plus the rehash-on-verify branch below.
**3 — Two hashes.** Tempting because it keeps passwords and PINs on one primitive server-side. It loses because it is security theatre: the synced copy is the exposed copy, so the weaker hash bounds the whole thing, and the stronger one only costs a second column and a second write path.
**4 — Online-only.** Ten of its 24 points are the reversibility inflation every do-nothing option gets free. It is refuted by the issue's first sentence: *"with no network at all, because an outage is exactly when the queue does not stop."*
**5 — Hand-written scrypt.** Ranked and kept because a reader will think of it. Salsa20/8 and ROMix by hand, unaudited, in the one function that guards the till. No.

**Unlock is *always* local — there is no online unlock path.** This is the deciding sub-call and it is 028's own principle applied: an online-first path with an offline fallback means the offline branch runs only during outages, which is *"a production path a test never executes"* — the exact defect 028 exists to remove. One path, exercised on every unlock, tested directly.

## Q2 — `packages/contract/src/pin.ts`, 600,000 iterations, 32-byte key, 16-byte random salt

`PIN_HASH_PARAMS = { iterations: 600_000, hash: "SHA-256", keyLength: 32, saltLength: 16 }`

- **`iterations: 600_000`** — OWASP's headline figure, quoted: *"PBKDF2-HMAC-SHA256: 600,000 iterations (recommended)"*. Deviating upward is not free (see the latency note) and buys the table above nothing. **Verification always uses the count parsed out of the stored string, never this constant** — 028's rule, so raising it later is not a migration.
- **`hash: "SHA-256"`** over SHA-512: the attacker cost is identical (14,762 vs 14,172 H/s above — OWASP calibrated them to be), and SHA-256 has ARMv8 hardware acceleration on the tablet where the defender pays, so it buys more iterations per second of a cashier's time. *The ARM claim is judgement, not sourced; it is a tiebreak, not the reason.*
- **`saltLength: 16`, from `crypto.getRandomValues`.** Nothing about the User goes into it. Per-row, never shared.
- **Cost: estimated 100–600 ms on a mid-range Android tablet — estimated, not measured.** **The implementer must measure it once on the target hardware and write the number into the issue.** If it exceeds 1 s, lower `iterations` — the count travels in the hash, so nobody is locked out. That is the calibration knob; do not add a Web Worker for it unless the measurement demands one.
- **Why it differs from `packages/backend/src/common/password.ts`'s `ln:17, r:8, p:1`:** that hash never leaves the server and is derived once per sign-in on an x86 host. This one is derived on a tablet, by a browser, with a cashier waiting, and it is copied onto that tablet's disk. Different threat, different hardware, different file. The two must never share a knob.
- **A free win over the password path:** WebCrypto's `deriveBits` is async and does not block the event loop, unlike the `scryptSync` record 033 measured at **258.9 ms** of whole-process blocking per call. The PIN set/change/reset handlers therefore do not need record 034's reserve-before-hash treatment.
- **Pinned by a known-answer test, not only a round-trip** (028's rule): **RFC 7914 §11, "Test Vectors for PBKDF2 with HMAC-SHA-256"** — vectors `P="passwd", S="salt", c=1, dkLen=64` and `P="Password", S="NaCl", c=80000, dkLen=64`. **Transcribed from the RFC, not from memory.** Same RFC 028 already cites.
- **Placement.** `packages/contract` is the only package the browser and the server can both reach, it has **no `node:` import today** (verified), and the hash string is literally part of `terminal.pinSync`'s wire format. `packages/backend/package.json` gains `"contract": "workspace:*"`. **If a reviewer objects to backend→contract, the fallback is `packages/schemas`, which both already depend on — one `git mv` and two import lines.**
- **Input rule:** `/^\d{4,6}$/`, enforced in the zod input schema **and** re-checked inside `hashPin`, which throws otherwise. **No blocklist of trivial PINs** (`0000`, `1234`) — 032 settled that a PIN's security is bought by throttling, and issue 11 owns that. Revisit if an operator asks.
- **The two alternatives, ranked and rejected:** 1,200,000 iterations doubles a cashier's wait to move the attacker from 75 s to 150 s, which is not a trade; OWASP's lower-memory equivalents are cheaper for the defender *and* the attacker, the wrong direction against a 10^6 keyspace.

## Q3 — `terminal.pinSync`, a Device-token query that takes no input at all

**Procedure:** `terminal.pinSync` — added to 056's `terminal` contract key (the POS's key; `device` remains the admin's). `oc.input(z.void()).output(pinRosterOutputSchema)`.

**Pulled, never pushed.** No push channel exists and the terminal is routinely unreachable. Called on POS mount via TanStack Query, alongside `terminal.me`.

| Field | Type | Why it is in, or how it is bounded |
| --- | --- | --- |
| `storeId` | `string` | From `ctx.device.storeId`. Lets the terminal detect a roster that is not its own |
| `syncedAt` | ISO string | Server clock, for a later staleness rule. **Not rendered anywhere in this issue** |
| `users[].userId` | `string` | Criterion 9's log subject |
| `users[].displayName` | `string` | `firstName + " " + lastName` (053). The mock's picker requires it. **Not an email** |
| `users[].pinHash` | `string \| null` | `null` = no PIN set yet, so the picker can show them and say so (criterion 1's "first use") |

**No `email`. No `role`. No `passwordHash`, ever. No other Store's userIds.** Role is absent because it is not needed: the server applies membership when it builds the list, so **every User in the payload is by construction someone who may unlock this Device** — "no role beyond what unlock needs" in its strongest form. Do not add one for a future manager-override screen; that issue can add it. **Membership (criterion 5), resolved effective-dated, never from `User.role`:** the roster is `User.active = true` AND (`getRoleAsOf(user, now) = 'admin'` OR the latest `UserStore` row for `(user, ctx.device.storeId)` with `effective_from <= now` has `assigned = true`). **Reuse `packages/backend/src/access/db-operations/queries/get-role-as-of.query.ts` and `get-assigned-store-ids-as-of.query.ts`** — do not write a second resolver. Runs inside `withTenantScope(db, ctx.device.tenantId, …)`; `User` already has RLS, so no new policy. **Consequence, stated rather than discovered: an `admin`'s PIN hash lands on every terminal in the tenant.** That is what criterion 5 asks for, and an admin whose unlock silently stopped working during an outage would be a support call in the worst hour. Reversal if unwanted: one clause in the roster query.

**Authorisation is structural, not checked.** The procedure has **no input**, so "a Device asking for a Store it is not enrolled at" has no field to ask with — 056's criterion-5 lock, inherited. `deviceCtx(ctx)` returning null is `unauthenticated`; a revoked Device never reaches the handler because `buildContextFromDeviceToken` refuses first. **Assert criterion 9 as:** enrol a Device at Store A, seed active Users at Store B, call `terminal.pinSync` as that Device, and assert the payload contains **no** Store B `userId` and no `email`/`passwordHash` key at all — plus no-token and revoked-token cases returning `unauthenticated`, plus a wrong-tenant probe (criterion 12).

**"The next payload" (criterion 8) is defined as: the next successful `terminal.pinSync` response.** Computed fresh from the database on every call — no cursor, no diff, no cache, no version — and the terminal **replaces its whole local copy atomically**, never merging. Deactivating a User therefore removes their hash on the next pull and reactivating restores it, with nothing to invalidate. **It is held in `localStorage`, one key `deanpos.pin.roster`, behind one accessor module `apps/pos/src/lib/pin-roster.ts`** — 056's Q3 pattern copied exactly, because IndexedDB and the service worker are `offline-sync`'s. **056's grep expectation is amended: `rg -n 'localStorage' apps/pos` must now return exactly `device-token.ts` and `pin-roster.ts`.** The XSS exposure is 056's argument unchanged, now covering hash material, and the successor is named: **encrypting the roster under a non-extractable WebCrypto key in IndexedDB is carried to `offline-sync` as this record's one outstanding mitigation**, alongside 056's CSP.

| Rank | Option | User ×2 | Bus ×1 | Eng ×2 | Rev ×2 | Evid ×3 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **`terminal.pinSync`, no input, full snapshot, pulled on mount** | 5 (10) | 4 | 5 (10) | 4 (8) | 4 (12) | **44** |
| 2 | Same payload but `input: { storeId }`, checked against `ctx.device.storeId` | 5 (10) | 4 | 3 (6) | 4 (8) | 3 (9) | **37** |
| 3 | Incremental sync with a cursor and per-User change events | 4 (8) | 4 | 1 (2) | 2 (4) | 2 (6) | **24** |

**2 — an explicit `storeId` input.** Reads more like the criterion, which literally says *"a Device requesting the payload for a Store it is not enrolled at is refused"*, and gives the refusal an obvious test. It loses because a check that can be forgotten is worse than a field that does not exist, and 056 already made this exact call for every Device-token procedure. **3 — incremental sync.** The right shape at a thousand terminals and pure cost at four; a Store's roster is tens of rows.

## Q4 — Both mocks built as drawn, minus two strips that belong to other areas

**Files:** `apps/pos/src/features/unlock/Unlock.tsx` (the screen), `UnlockGate.tsx` (`actingUser ? children : <Unlock/>`), `__common/queries.ts` (`usePinRosterQuery`). Rendered from `apps/pos/src/routes/index.tsx`, which keeps holding no JSX (ADR-0009). **The gate lives in the feature, not `__root.tsx`, because there is one screen behind it; it moves up when the second POS screen lands.** **Reused from `features/enrolment/` — this screen invents nothing:** the existing `AppShell` unchanged, the centred `Card` in `flex flex-1 items-center justify-center p-4`, a plain `<form>` + `useState` (no TanStack Form), `aria-disabled` on the submit button rather than `disabled`, the `role="alert"` failure block with **one message for all causes**, and the `Toaster` already mounted in `main.tsx`. From `packages/ui`: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Button`, `Input`. **Nothing new in `packages/ui`, no new dependency, no new token.**

| Part of the mock | Owner |
| --- | --- |
| Header line `{storeName} · {deviceName}` (from `readDeviceIdentity()`), picker, PIN display, keypad, backspace, Unlock | **This issue** |
| `Too many attempts — locked for 2:00` strip | **Issue 11.** Not built — 009 forbids a state that cannot be true |
| `OFFLINE · 3 queued` | **`offline-sync`.** No queue exists to count, and `navigator.onLine` reports "online" behind a captive portal — a badge that lies about connectivity is worse than no badge on the one screen a cashier must trust |

The 1280 mock's `DeanPOS · ` prefix is `AppShell`'s existing wordmark; the screen renders only `{storeName} · {deviceName}`, which is what the 390 mock draws. `AppShell` gains **one** thing: a `Lock` button in the header, rendered only when `actingUser !== null`. **The keypad is built from `Button` and nothing else:** one `<div className="grid grid-cols-3 gap-2">` holding twelve cells in the mock's order — `1`–`9`, then `⌫`, `0`, `Unlock`. Digits and backspace are `<Button type="button" variant="outline">`; `Unlock` is `<Button type="submit">` in the grid's last cell, as drawn. Backspace's glyph is `aria-hidden` behind `aria-label="Backspace"`.

**Accessibility beats the drawing, and the mechanism is native.** A keypad that only works by pointer fails SC 2.1.1. The masked display is therefore **a real `<Input type="password" inputMode="none" autoComplete="off" spellCheck={false}>`** styled `text-center text-2xl tracking-widest`, not a row of dots. MDN on `inputmode="none"`, quoted: *"No virtual keyboard. For when the page implements its own keyboard input control"* — Baseline widely available since December 2021. So a hardware keyboard types straight into it, a screen reader announces a labelled field, and no software keyboard fights the on-screen keypad at 390. **One setter serves both inputs:** `setPin(next.replace(/\D/g, "").slice(0, 6))`. **No `maxLength` attribute** (032) — the cap is explicit in that one function, and the keypad's append is a no-op at six digits.

| Every state the mock does not draw | What it is |
| --- | --- |
| Picker | `<div role="group" aria-labelledby="who-is-on-the-till">` of `<Button type="button" aria-pressed={selected}>` tiles. Not a `Select`, not a roving-tabindex radiogroup — every tile is tabbable and native. Choosing one moves focus to the PIN field |
| Unlock unavailable | `aria-disabled` (never `disabled`) until a User is chosen **and** `pin.length >= 4`; handler returns early. Backspace likewise at zero digits |
| Pending | Label swaps `Unlock` → `Unlocking…`, 056's shape. **No spinner** — the derivation is ~0.1–0.6 s. If measurement shows over 1 s, move it to a Web Worker; do not add a dependency |
| Wrong PIN | One `role="alert"`: `That PIN is not correct`. Clears the PIN field, keeps the selected User. **One message for every cause** — never "no such user" versus "wrong PIN" |
| Chosen User has no PIN | `role="alert"`: `{name} has no PIN yet. Connect to the network to set one`; Unlock stays `aria-disabled` |
| Roster never synced | In the picker's slot: `No one is set up at this till yet. Connect once to load the store's users` |
| Roster pull fails, cached roster exists | **Silent.** The cached roster is used and nothing is shown. This is criterion 4 working |
| Device revoked | 056's existing blocked screen, unchanged. It gates the whole app, so unlock is unreachable behind it |
| Hover / focus | The shipped `Button`'s hover and the global `:focus-visible` (014). Not re-picked |
| Target size | Tiles and keys far exceed SC 2.5.8's 24×24. If a shipped `Button` default falls short, use its existing larger `size` variant, never a new token |

**What changes at 390.** Only the picker: `grid-cols-2 sm:grid-cols-4`, matching the 2×2 the 390 mock draws and the 4-across the 1280 mock draws. **The keypad is `grid-cols-3` at every width — both mocks draw it identically, so there is no breakpoint on it.** Container `w-full max-w-2xl` (the 1280 mock's 684px column). `AppShell` already scrolls at 390; no change. Criterion 11's axe check uses the existing `expectNoAxeViolations` from `apps/api/src/test-seam-react.tsx`, at both widths. **Small call, reversible:** the button reads `Unlock`, not `UNLOCK` — the mock binds the word, casing is type styling, and every other button in the product is sentence case.

| Rank | Option | User ×2 | Bus ×1 | Eng ×2 | Rev ×2 | Evid ×3 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Real `<input inputmode="none">` + `Button` grid; lockout and offline strips deferred** | 5 (10) | 4 | 5 (10) | 5 (10) | 5 (15) | **49** |
| 2 | The mock literally: dot display, keypad-only entry, both strips drawn | 3 (6) | 3 | 3 (6) | 4 (8) | 2 (6) | **29** |
| 3 | A `readOnly` input with a roving-tabindex keypad widget | 4 (8) | 3 | 2 (4) | 3 (6) | 3 (9) | **30** |

**2 — the mock literally.** A dot display with pointer-only entry fails SC 2.1.1 outright, and both strips would render states that cannot be true today. **3 — roving tabindex.** Technically conformant and a real pattern, and it loses because it is a new interaction pattern the codebase has no precedent for, built to replace one native attribute.

## Q5 — In memory only. Lock is `setActingUser(null)` and touches no storage key.

- `apps/pos/src/lib/acting-user.tsx`: a React context holding `useState<{ userId: string; displayName: string } | null>(null)`, mounted in `main.tsx` beside the existing providers. **It never holds a PIN or a PIN hash.**
- **It does not survive a page reload.** That is the correct posture, not a limitation — the whole point of Lock is that stepping away ends the session, and a reload is indistinguishable from a stolen moment at the till. It is also the laziest: no persistence code, no expiry, no clearing path.
- The cost is bounded precisely because of Q1: after a reload the cashier re-enters four to six digits, **and that works with no network**, because the roster and the Device token both survive in `localStorage`. Reload → PIN prompt → serving. That combination is the design.
- **Lock, in full: `setActingUser(null)`.** Nothing else. It must never call `clearDeviceToken()`, and must never touch `deanpos.device.token`, `deanpos.device.identity`, or `deanpos.pin.roster`. Test it as its own case: lock, then assert all three keys are still present and the PIN prompt is showing.

| Rank | Option | User ×2 | Bus ×1 | Eng ×2 | Rev ×2 | Evid ×3 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **React state only; lost on reload** | 4 (8) | 5 | 5 (10) | 5 (10) | 4 (12) | **45** |
| 2 | `sessionStorage`, cleared on Lock | 4 (8) | 3 | 4 (8) | 4 (8) | 3 (9) | **36** |
| 3 | `localStorage` with an idle timeout | 3 (6) | 2 | 2 (4) | 3 (6) | 2 (6) | **24** |

**2 — `sessionStorage`.** Survives a reload but not a tab close, and it is one line more. It loses because it adds a second clearing path to get wrong for a convenience whose cost is a 4-digit offline re-entry. **3 — `localStorage` + idle timeout.** Persists the acting User across a reboot, which is a stolen tablet still logged in as a named cashier, and buys a timer this record has otherwise banned.

## Q6 — One grep test, one query fixed, and no wrapper type

**The pattern to copy is `apps/api/tests/platform-admin-no-password-logging-grep.test.ts`** — 028 named it and 056 used it. New file `apps/api/tests/pin-no-logging-grep.test.ts`, two assertions:

1. **No log call naming a PIN.** No `console.*` or logger call in `packages/backend/src`, `apps/api/src`, `apps/pos/src` or `packages/contract/src` whose argument text matches `/pin/i`.
2. **The stronger one — an allow-list on the identifier itself.** `pinHash` / `pin_hash` may appear only in: `packages/contract/src/pin.ts`, `packages/contract/src/contract.ts`, the Prisma schema and its migration, the roster query, the set-PIN command, `apps/pos/src/lib/pin-roster.ts`, `apps/pos/src/features/unlock/**`, and tests. Anything else is a new path to the hash and should have to argue for itself.

**And the concrete defect this criterion is really about, which a grep would not have caught:** `packages/backend/src/user/db-operations/queries/list-users.query.ts` is `db.selectFrom("User").selectAll()`. **The day `User.pin_hash` is added, that query starts returning every User's PIN hash into the back-office user list.** It must switch to an explicit column list omitting `pin_hash` *and* `password_hash`, in the same commit as the migration. `find-user-by-email-for-sign-in.query.ts` has the same `selectAll()` shape; it is server-side only, so narrowing it is defence in depth rather than a fix. **The implementer must check whether the handler already strips these before claiming the current code is safe.**

**Refused: a branded `Pin` wrapper type** — TypeScript types do not exist at run time and `console.log` prints the value regardless; an abstraction with one implementation that cannot enforce its own rule is rung 1 of the ladder. **And criterion 9's "Log the User id and the Device id" is a *shape* rule, not a requirement for a new log line.** No unlock audit table and no unlock log is built: an offline unlock is invisible to the server by construction, so a server-side unlock log would record only the online subset and misrepresent the till's history — worse than none. That telemetry is `offline-sync`'s.

## Smaller calls, flagged reversible

1. **Migration `20260803150000_pin_unlock`** — additive only: `ALTER TABLE "User" ADD COLUMN "pin_hash" TEXT;` (nullable, no default, no backfill). `deanpos_app`'s grant on `"User"` is table-level `SELECT, INSERT, UPDATE` today, so **no new grant is needed** — the implementer must confirm that against the latest migration before relying on it.
2. **`verifyPin` branches on the algorithm id**, exactly as `verifyPassword` does, so moving to argon2id or scrypt later is additive with rehash-on-verify. Anything not `pbkdf2-sha256` returns `false`.
3. **No roster expiry.** A staleness rule would stop a genuinely offline store from selling, which is a bigger loss than a stolen tablet that already holds the Device token. `syncedAt` is carried so `offline-sync` can add one. **Trigger: `offline-sync` establishing a maximum offline window.**
4. **A `pinSync` refusal does not clear the roster** — 056's no-go, unchanged; the blocked screen already gates the app. **PIN set / change / admin-reset handlers** live beside the existing password ones and reuse their shapes; admin-reset writes no PIN into any response or log, only `{ ok: true }`. `ponytail: reset clears the hash to NULL rather than minting a temporary PIN — the User sets their own on next use, which is criterion 1's own wording.`

## What must not be built

- **No `node:crypto` import in `packages/contract`** (the one thing that would silently un-break the browser); **no second KDF, no runtime branch, no `typeof window` fork** in `pin.ts` — 028's first no-go, and the reason WebCrypto was chosen over anything Node-only.
- **No `timingSafeEqual` in the PIN path** (unreachable in a browser) and **no `===` on a derived key** — a constant-time loop over the two arrays.
- **No lockout strip, no offline/queued badge, no countdown, no interval, no timer** anywhere on this screen. **No PIN blocklist, no PIN expiry, no PIN history, no unlock audit table.**
- **No `email`, no `role`, no `passwordHash` field in the roster payload, ever**; no `storeId` or `tenantId` input on any Device-token procedure; and **no `selectAll()` on `"User"` in any query that reaches a response.**

## What issue 10 must change, because an implementer may not

**Replace acceptance criterion 2** with:

> - [ ] PIN hashing uses **PBKDF2-HMAC-SHA-256 via WebCrypto** (record 057) with **its own parameters in its own file**, chosen knowing the hash sits on a tablet and must be verified by a browser with no network; the hash/verify round-trip **and RFC 7914 §11's published vectors** are tested **directly, not through the seam**. It deliberately does **not** share the password primitive of record 028 — `node:crypto` does not exist in a browser and WebCrypto has no scrypt, so criterion 4 could not otherwise hold. The password policy of record 032 does not apply to PINs.

**Replace the `## What to build` paragraph at lines 18–19** (`PIN hashing uses **node:crypto scrypt**…`) with:

> PIN hashing uses **PBKDF2-HMAC-SHA-256 via WebCrypto**, with **its own parameters in its own file** — see [record 057](../../decisions/057-pin-unlock-verifies-locally-with-pbkdf2.md). It is deliberately not the scrypt record 028 chose for passwords: scrypt cannot run in a browser, and criterion 4 requires the terminal to verify a PIN with no network at all.

**No other criterion changes. No other issue is affected. Record 028 is not overturned** — its final no-go reserved this exception in terms (*"unless issue 10 writes its own record saying why not"*), and its last "what would make this wrong" bullet named this question in advance.

## How to turn it back

| What | Cost |
| --- | --- |
| The KDF (Q1 → option 2 or 3) | `packages/contract/src/pin.ts`. **Measured, not estimated: one file, three importers** (`packages/backend`'s set-PIN command, `apps/pos/src/features/unlock/`, the tests). The self-describing hash string plus a rehash-on-verify branch means **no migration and no forced PIN reset** — the same property 028 bought and this record inherits |
| The parameters (Q2) | One object literal. Existing hashes keep verifying with their own stored count |
| Payload shape (Q3) | Additive fields are free. **Removing a field is not, once `offline-sync` reads it** — the reversal cost that grows soonest. The `pin_hash` column is additive too; **dropping it is a data migration and is not mine to decide** |
| Roster storage (Q3) | `apps/pos/src/lib/pin-roster.ts`, one file. The accessor module is what keeps it one |
| The screen (Q4) and the acting User (Q5) | One commit under `apps/pos/src/features/unlock/` and `lib/acting-user.tsx`. Free, permanently |
| Formally | Write a superseding record; flip this `Status:` to `overturned` with the date and reason; update both `LOG.md` lines; re-run the gate |

## What should make you reverse this

- **A browser ships Argon2 or scrypt in WebCrypto.** Node already exposes Argon2 through the WICG *Modern Algorithms* proposal, and **no browser implements it** — that asymmetry is the whole reason this record exists. **The trigger is Chrome or Safari shipping it, and it is a fifteen-minute re-check, not a project.** Q1 then collapses into one obvious answer.
- **Someone measures PBKDF2 at 600,000 iterations taking more than one second on the target tablet.** Lower the iteration count; do not add a dependency and do not add a Web Worker first. **This is the assumption I am least confident about**, because the latency figure above is estimated and the hardware is not specified anywhere in the repo.
- **A PIN is ever accepted without a valid Device token**, anywhere, by any path. That voids the entire argument that a crackable roster is tolerable, and it is a defect by the issue's own governing rule rather than a decision to revisit.
- **`offline-sync` never encrypts the roster at rest**, or `release-ops` never ships a CSP for the POS origin. Then the honest statement is that a roster of grindable credentials rests on the absence of injected script and nothing else.
- **The product ever needs a PIN to authenticate somewhere a Device token is not present** — a manager approving a refund from a phone, say. Then the PIN has become a standalone credential, 4–6 digits is indefensible, and this is superseded rather than tuned.
- **`terminal.pinSync` is ever given an input parameter.** That is the structural refusal in Q3 having quietly become a checkable one, and the check will eventually be forgotten.

## Evidence

**Repository, read 2026-08-03, worktree `.worktrees/_main-admin` (branch `main`):**

- The issue in full, and **both SVGs read in full** — the four picker tiles, the four-dot display, the 3×4 keypad with `⌫`/`0`/`UNLOCK` on the bottom row, the header strip and its `OFFLINE · 3 queued`, and the lockout strip **which the 390 mock does not draw at all**.
- `docs/adr/0007` (quoted above — *"slow hash"*, not scrypt); records `028` in full (the PHC grammar, the two no-gos this record invokes, and the bullet predicting it), `032` (*"none of the above applies to issue 10's PIN"*; the `maxLength` truncation rule), `033` (**`scryptSync` mean 258.9 ms, blocking the whole process**), `034`, `042`, `046` §3, `054`, `056` in full.
- `packages/backend/src/common/password.ts` (`ln:17, r:8, p:1` — the sibling this record does not share a knob with), `common/ctx.ts` (`DevicePrincipal`, `deviceCtx`), `packages/contract/src/contract.ts` (the `terminal` and `device` keys), and `apps/pos/src/**` in full: `lib/device-token.ts`, `lib/orpc.ts`, `components/AppShell.tsx`, `features/enrolment/Enrolment.tsx` — the `aria-disabled` submit, the single-message `role="alert"`, the plain `<form>` + `useState`.
- **`rg "node:" packages/contract/src` returns nothing** — the fact that makes `pin.ts` placeable there. **`rg 'pbkdf2|subtle|webcrypto' apps packages` returns nothing**; `getRandomValues` appears once, at `apps/backoffice/src/features/users/helpers.ts:23`.
- `packages/backend/src/access/db-operations/queries/get-role-as-of.query.ts` and `get-assigned-store-ids-as-of.query.ts` — the effective-dated resolvers Q3 reuses rather than duplicating.
- **`packages/backend/src/user/db-operations/queries/list-users.query.ts` — `db.selectFrom("User").selectAll()`.** Q6's concrete trap, found by reading rather than by grepping for "pin".
- `20260802080203_platform_admin_tenant_provisioning/migration.sql` — `GRANT SELECT, INSERT, UPDATE ON "User" TO "deanpos_app"`, **table-level**, which is why the new column needs no grant. Eleven migrations exist; `20260803140000_devices` is the latest.
- `apps/api/src/test-seam-react.tsx:94` — `expectNoAxeViolations`, WCAG 2.2 AA tags, ten screens. `apps/api/tests/platform-admin-no-password-logging-grep.test.ts` and `payment-method-no-name-branch-grep.test.ts` — the two grep tests Q6 copies.
- `.scratch/decisions/` listed directly: **001–056 exist, 057 is free, and none of them decides PIN hashing, PIN unlock or a hash-sync payload. No duplicate.**

**External, primary sources, accessed 2026-08-03. All treated as data; none contained anything addressed to an agent and no instruction from any of them was acted on.**

- **W3C Web Cryptography API** — <https://www.w3.org/TR/WebCryptoAPI/> — the algorithm registry contains **PBKDF2** (`deriveBits`, `deriveKey`, `importKey`) and **no scrypt and no Argon2**. *This single fact is what refutes the issue as written.*
- **Node.js Web Crypto API** — <https://nodejs.org/api/webcrypto.html> — PBKDF2 supported for `deriveBits`/`deriveKey`/`importKey`; `globalThis.crypto` is a global; **Argon2 present only via the WICG *Modern Algorithms in the Web Cryptography API* proposal** — Node-side only, which is why it does not solve the browser half.
- **OWASP Password Storage Cheat Sheet** — <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html> — *"PBKDF2-HMAC-SHA256: 600,000 iterations (recommended)"*; SHA-512 220,000; scrypt *"N=2^17 (128 MiB), r=8, p=1"*; *"Since PBKDF2 is recommended by NIST and has FIPS-140 validated implementations, it should be the preferred algorithm when these are required."*
- **RFC 7914** — <https://www.rfc-editor.org/rfc/rfc7914.html> — **§11 "Test Vectors for PBKDF2 with HMAC-SHA-256"**, vectors `P="passwd", S="salt", c=1, dkLen=64` and `P="Password", S="NaCl", c=80000, dkLen=64`. **Transcribe from here.**
- **hashcat v6.2.6 raw benchmark output, single RTX 4090** — <https://gist.github.com/Chick3nman/32e662a5bb63bc4f51b847bb422222fd> — mode 10900 `8865.7 kH/s`, Iterations 999; mode 12100 `3120.9 kH/s`, Iterations 999; mode 8900 (scrypt) `7126 H/s`, Iterations 16384. **All four rows of Q1's table are linear scalings of these three lines and are labelled as scalings, not measurements.**
- **MDN, `inputmode`** — <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode> — `none`: *"No virtual keyboard. For when the page implements its own keyboard input control."* Baseline widely available since December 2021.
- **W3C WCAG 2.2** — SC 2.1.1 Keyboard, SC 2.5.8 Target Size (Minimum), SC 4.1.3 Status Messages, consumed from records 038/054/056.

**Searched for and not found, where the absence mattered:**

- **No authority publishes a recommended KDF work factor for a short numeric PIN.** OWASP's cheat sheet says nothing about PINs or short numeric secrets — asked for directly, absent. **Q1's whole argument therefore rests on the arithmetic in the open above and on ADR-0007's stated acceptance, not on an external authority.** Padding this section with adjacent links would be worse than saying so.
- **No browser vendor has shipped Argon2 or scrypt in WebCrypto**, and the WICG *Modern Algorithms* proposal is not a Recommendation. Searched specifically; every browser-side Argon2 result was a WASM library, which is the dependency Q1 option 2 refuses.
- **PBKDF2's cost on the actual tablet was not measured** — no target hardware is named anywhere in the repository. The 100–600 ms figure is an estimate from SHA-256 throughput and is flagged as one; measuring it is an explicit instruction to the implementer, not an assumption this record makes.
- **`nodejs.org/api/crypto.html` and the WHATWG HTML standard both truncated** before the sections quoted from elsewhere, so the `inputmode` definition is cited from MDN rather than the specification. Stated rather than hidden; it does not affect correctness, since `inputmode` is Baseline.
