# 056: Devices get their own audit table, a 256-bit bearer token stored as one SHA-256, an admin-typed short code the database keeps unique, and a fourth `Ctx` arm whose field is not `principal`

- **Status:** decided
- **Stakes:** high — a new credential, two new tables, an append-only audit trail, an access-control boundary, and a short code that every Order number is built from
- **Date:** 2026-08-03
- **Asked by:** the orchestrator, for `.scratch/tenancy-identity/issues/09-device-enrolment-and-revocation.md` (criteria 1–11)
- **Relates to:** [046](046-how-tenant-settings-are-stored-and-audited.md) §3 and [054](054-payment-method-availability-and-its-audit.md) (audit shape — **054's named trigger fires here**); [031](031-how-a-query-with-no-tenant-reads-a-row.md) (pre-auth lookups); [032](032-the-password-policy.md)/[033](033-throttling-sign-in.md) (hashing and the blocking event loop); [038](038-the-store-management-screen.md)/[049](049-the-editor-is-a-detached-sheet.md)/[050](050-the-sheet-form-shell.md) (the shipped list/editor pattern)

## The questions

Six, on one issue. **Q1** where Device audit rows live, and whether the two shipped audit tables are generalised now. **Q2** how the Device token is generated, hashed and compared. **Q3** how the terminal keeps it across a reboot. **Q4** the short code's format, author and uniqueness constraint. **Q5** the two screens as lo-fi. **Q6** how a procedure declares which principal it takes. A wrong answer costs four ways: an audit row that can never be corrected; a hash that blocks the API on every request from every terminal; a short-code collision that pays a refund against the wrong sale; and a Device token accepted where a session cookie was meant, which is a stolen tablet with a back office attached.

## What was already decided, and is not revisited

- **ADR-0007:** *"A stolen enrolled Device is the primary threat"*; enrolment and revocation are admin-only and audited. **This issue owns the `revoked` flag and the every-request check only** — queue depth, replay quarantine and adjudication are `offline-sync`'s and `hardening`'s.
- **046 §3 / 054 Q1, inherited whole:** RLS `ENABLED`+`FORCED`, policies in the same migration, `FOR SELECT`/`FOR INSERT` only on an audit table, `REVOKE ALL` then `GRANT SELECT, INSERT`, composite `(tenant_id, …)` FKs because plain FK checks bypass RLS, `CHECK`s not comments, `actor_user_id` `NOT NULL`. **Copy `migrations/20260803010000_tenant_settings/migration.sql`, not 046's prose.**
- **031's pre-auth shape, copied literally:** a lookup with no tenant travels on its own session variable, its policy reads `nullif(current_setting('app.<x>', true), '')`, and **the transaction runs exactly one statement** (`session_self_lookup`, `user_login_lookup`). **027:** applied migrations are frozen; ten exist, these are the eleventh.
- **Consumed and not restated:** 038's `Card` + `ListToolbar` + `useTableView` + `TablePagination` + `overflow-x-auto py-1` (**`py-1` load-bearing**); 049's `modal={false}` sheet; 050's `SheetForm`; 041's dialog copy; 009's "no control that does nothing" and "no state that cannot be true"; 013's density rule; 014's `:focus-visible`. **No new dependency, no new `packages/ui` component, no new token or colour** — 042 stands.

### Weights, declared before any option was scored

**User ×2** (an admin enrols a terminal a handful of times a year; the cost lands when a till cannot sell) · **Business ×1** (nothing earns; the one fact is a stolen tablet trading on a Store's full authority) · **Eng cost/risk ×3** (five of six questions are a table, a credential path, or a principal — this is where the question lives) · **Reversibility ×2** (two migrations, and a token format that once a terminal holds it cannot change without re-enrolling every terminal by hand) · **Evidence ×2** (the mock contradicts the issue twice, and the leading external claim behind Q2 could not be sourced). Maximum 50. **Not changed after scoring.**

## Q1 — A third per-area table, `DeviceAudit`. The generalisation is escalated, not decided.

**054's trigger fired and I am recording that plainly** — *"Two tables is a pattern; three is a shape."* I am still not generalising, for two reasons 054 did not have. **First, the generalisation is a non-additive migration and therefore not mine:** renaming `TenantSettingsAudit`, migrating its rows, folding `PaymentMethodAudit` in and dropping it touches two merged tables with live rows in `DeanPOS_dev`, and the constraint is explicit. **Routed to the human as a named follow-up**, with ADR-0006's expand/contract as the mechanism. **Second, a generalised table cannot keep the property 054 decided on:** its subject would be `subject_type TEXT` + `subject_id TEXT` with **no foreign key possible** — precisely the "composite key smuggled into a text column no FK can check" that 054 refused, on a table where `UPDATE` and `DELETE` are policy-denied so a malformed row is permanent. Generalising trades a checkable trail for a convenient one.

**`DeviceAudit`, structure copied from `PaymentMethodAudit`:** `id`, `tenant_id`, `actor_user_id` (`NOT NULL`), `device_id` (nullable), `enrolment_code_id` (nullable), `field`, `old_value` (nullable), `new_value` (`NOT NULL`), `created_at`; `@@index([tenantId])`.

- **Two nullable subject columns, exactly one set** — `code_generated` happens before a Device exists, so its subject is the `EnrolmentCode`. Joinable, FK-checked, not a string.
- **Four `CHECK`s:** `"field" IN ('code_generated','name','revoked')`; `(("device_id" IS NULL)::int + ("enrolment_code_id" IS NULL)::int) = 1`; `("field" = 'code_generated') = ("enrolment_code_id" IS NOT NULL)`; `("old_value" IS NULL) = ("field" <> 'name')`.
- **Four FKs, all `ON DELETE RESTRICT ON UPDATE CASCADE`:** `tenant_id → Tenant(id)`, and composite `(tenant_id, actor_user_id) → "User"`, `(tenant_id, device_id) → "Device"`, `(tenant_id, enrolment_code_id) → "EnrolmentCode"`. **`Device` and `EnrolmentCode` must be created carrying `@@unique([tenantId, id])`** or the FKs cannot be built.
- **The enrolment exchange writes no audit row.** Its actor is a terminal, not a User, and 054's rule holds: a nullable actor is how a trail starts admitting rows nobody signed. `Device.enrolled_at` and the consumed `EnrolmentCode` row carry that fact instead.

| Rank | Option | User ×2 | Bus ×1 | Eng ×3 | Rev ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **New `DeviceAudit`, 054's structure exactly** | 4 (8) | 4 | 4 (12) | 3 (6) | 5 (10) | **40** |
| 2 | New generalised `AuditEvent`, Devices only, two old tables left in place | 3 (6) | 3 | 3 (9) | 2 (4) | 3 (6) | **28** |
| 3 | Defer to the human | 1 (2) | 2 | 3 (9) | 5 (10) | 1 (2) | **25** |
| 4 | Generalise 046+054 by rename and backfill | — | — | — | — | — | **not mine** |

**2. Additive `AuditEvent` used by Devices only.** Genuinely tempting — it is the expand half of ADR-0006 and needs no human. It loses because it ships *three* audit tables with an ambiguous rule about which one a new area writes to, while giving up the subject FK, and its contract phase still needs the escalation option 1 already asks for. **3. Defer.** Ten of its 25 points are the reversibility inflation every do-nothing option gets free; issue 09 cannot ship without criterion 11. **4.** Listed because it is what 054 pointed at, and refused on mandate, not on merit.

## Q2 — 32 random bytes, base64url, stored as one SHA-256 hex digest, compared by a unique index

| Step | Exact call |
| --- | --- |
| Generate | `randomBytes(32).toString("base64url")` from `node:crypto` — 256 bits, 43 characters, URL- and header-safe |
| Hash | `createHash("sha256").update(Buffer.from(token, "utf8")).digest("hex")` — 64 lowercase hex characters |
| Store | `Device.token_hash TEXT NOT NULL`, `CREATE UNIQUE INDEX "Device_token_hash_key"` |
| Compare | `where("token_hash","=",hash)` on that index. **No application-level comparison exists**, so no `timingSafeEqual` |

**Why the password rule does not transfer — three reasons, and the third is the one that decides it.**

1. **A work factor buys nothing here.** scrypt exists to make an offline search of a *small, human-shaped* distribution expensive. A uniformly random 256-bit token has no distribution to search — OWASP's floor for a session identifier is 64 bits and this is four times it. **No salt is needed either:** per-row salts stop one precomputed table covering many rows, and nothing can be precomputed against an unguessable preimage. Unsalted is also what makes an *indexed* lookup possible at all; a salted hash can only be iterated.
2. **The cost is disqualifying, and it is measured, not estimated.** Record 033 established that `scryptSync` blocks the entire single-threaded API for the whole derivation, and the implementer measured **258.9 ms**. A password pays that once per sign-in. A Device token is checked on **every** request: one terminal at one request per second would consume ~26% of the process and four would saturate it. That is not a parameter to tune, it is a different requirement.

**Timing, stated because a reviewer will stop on it.** The index probe is not constant-time and does not need to be: the attacker cannot construct a token whose SHA-256 has a chosen prefix, so there is no digest to walk byte by byte. Preimage resistance is the property relied on, named here so nobody later "hardens" this into a full-table scan with `timingSafeEqual`.

**Never in a log, an error, or a URL.** The plaintext appears in exactly one place in the whole contract — `terminal.enrol`'s response body — and never again; `device.list` **cannot** leak it, because the row holds only a digest. Every refusal is the `unauthenticated` Ctx, never a message naming the token. `Authorization: Bearer <token>`, scheme matched case-insensitively, any other scheme `unauthenticated` rather than an error. The token never enters a query string, a route param, a TanStack Query key or React state.

| Rank | Option | User ×2 | Bus ×1 | Eng ×3 | Rev ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **`randomBytes(32)` → base64url; SHA-256 hex; unique-index lookup** | 5 (10) | 4 | 5 (15) | 4 (8) | 4 (8) | **45** |
| 2 | `<deviceId>.<secret>` composite token; look up by id, `timingSafeEqual` the secret | 5 (10) | 4 | 3 (9) | 4 (8) | 4 (8) | **39** |
| 3 | scrypt via `packages/backend/src/common/password.ts` | 1 (2) | 3 | 1 (3) | 3 (6) | 2 (4) | **18** |

**2. Composite token.** The textbook shape, and the honest runner-up: it removes the "is an index probe timing-safe" conversation entirely and permits a salted hash later. It loses on cost — a parseable token format, a split, an id-shaped half that leaks a Device id to anyone who sees the token, and a comparison to get wrong — for a property option 1 already has. **3. scrypt.** Ranked last on the arithmetic above, not on principle; it is what record 028 chose for the thing it was chosen for.

## Q3 — `localStorage`, two keys, one module, and the XSS exposure stated rather than mitigated away

The service worker and IndexedDB are `offline-sync`'s by the issue's own Comments; `sessionStorage` fails criterion 7 on the first reboot; a cookie fails criterion 6 by construction. What is left is what the platform already offers, and it is enough: **`localStorage`, two keys — `deanpos.device.token` holding the 43-character token alone with no JSON wrapper, and `deanpos.device.identity` holding `{ deviceId, name, code, storeId, storeName }`, which carries no secret so a dump of it is harmless.** Written and read only by `apps/pos/src/lib/device-token.ts` (`readDeviceToken` / `writeDeviceToken` / `clearDeviceToken`), the only file in the repository that names these keys, and attached in `apps/pos/src/lib/orpc.ts`, which **already** passes a custom `fetch` to `createClient` — one file, one header, no new plumbing.

**The exposure, honestly.** OWASP is unambiguous: *"A single Cross Site Scripting can be used to steal all the data in these objects."* Any injected script on the POS origin reads this token and gains one Store's full authority until an admin revokes it. Three facts make that acceptable, and none of them is "it probably won't happen":

- **The excluded alternative is not safer.** IndexedDB is read by same-origin script identically; the issue excluded it for ownership reasons, not security ones. The only materially better answer is a non-extractable WebCrypto key with per-request signing — **a different authentication scheme, not a storage choice**, needing its own record and a human.
- **The blast radius is bounded and the kill switch is in this issue.** One Store, no back office, no other tenant, and criterion 10 makes revocation effective on the *next* request.
- **The origin is hardenable and the obligation is named:** `apps/pos` renders no user-authored HTML, uses no `dangerouslySetInnerHTML`, and loads no third-party script tag or analytics snippet. **A Content-Security-Policy on the POS origin is carried to `hardening`/`release-ops` as this record's one outstanding mitigation** — it is what turns the argument above from an assertion into a control.

**No-go, and it is a money rule, not a storage one: a refused request never auto-clears anything.** A revoked Device may hold unsynced Orders — real takings. A refusal renders a blocked screen (`This terminal has been revoked. An admin must enrol it again.`) and clears nothing. Only `enrol()` clears, and it clears *before* writing, which is what satisfies criterion 8's "begins from empty local state". The wholesale purge of cached catalog and queued Orders is `offline-sync`'s and is not built here.

| Rank | Option | User ×2 | Bus ×1 | Eng ×3 | Rev ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **`localStorage`, two keys, one accessor module** | 5 (10) | 4 | 5 (15) | 5 (10) | 4 (8) | **47** |
| 2 | `HttpOnly` cookie on the API origin | 3 (6) | 3 | 2 (6) | 3 (6) | 3 (6) | **27** |
| 3 | Non-extractable WebCrypto key + request signing | 4 (8) | 5 | 1 (3) | 1 (2) | 2 (4) | **22** |

**2. `HttpOnly` cookie.** The only option that actually resists an XSS *read*, and OWASP names it. It loses outright on the issue: criterion 6 requires the `Authorization` header and CSRF immunity, and a cross-origin cookie would need `SameSite=None` — reintroducing exactly the attack the header was chosen to sidestep. **3. Signed requests.** The right long-term answer and the pre-decided successor if the POS ever runs on hardware the operator does not control; refused now as a new auth scheme with a reversal cost of 1.

## Q4 — Two to four characters, admin-typed, uniqueness a full unique index that includes revoked rows

| Decision | Value |
| --- | --- |
| Charset | `A`–`Z` **without `I`, `L`, `O`**, plus `0`–`9`. 33 symbols. Stored upper-case. |
| Length | 2 to 4 characters |
| Author | The **admin types it**, at code-generation time, beside the name and the Store. No generator, no suggestion. |
| Column | `Device.code TEXT NOT NULL`, `CHECK ("code" ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ0-9]{2,4}$')` |
| Constraint | `CREATE UNIQUE INDEX "Device_tenant_store_code_key" ON "Device"("tenant_id","store_id","code");` — **full, no `WHERE`** |

**`I`, `L` and `O` are excluded and `1` and `0` are kept**, which is Crockford's own rule read for this product's shape: *"when decoding, … `i` and `l` will be treated as `1` and `o` will be treated as `0`."* Dropping the digits instead would forbid `C1` for Counter 1, the single most natural code there is. The hazard being closed is exact: `O1-0421` and `01-0421` are different Order numbers at the same Store, and a refund read down a phone line cannot tell them apart. Excluding the letters makes the confusable form unwritable rather than merely discouraged.

**The absence of a `WHERE` clause is the whole of criterion 3's second half.** A revoked Device's row stays in the table and keeps holding its code, so `C2` at Malabon can never be reissued — no flag, no tombstone table, no application check. `store_id` sits inside the key, so `C2` at Cubao is unaffected, which is what the criterion permits. Contrast `PaymentMethod_one_cash_per_tenant`, the one partial index in the schema: partial is what you want when the constraint should lapse, and here it must not.

**Two to four is judgement and is labelled as such** — 2 so a single character is not a code, 4 so `C2-0421` stays readable on a receipt and speakable on a phone. Widening the `CHECK` is additive; narrowing it is not. **Reservation versus constraint.** The short code is chosen when the enrolment code is generated, hours before the Device row exists, so two outstanding enrolment codes could both claim `C2`. The generation handler does an **advisory** check (against `Device` and against unconsumed `EnrolmentCode` rows) purely to produce a good message; **the hard guarantee is the unique index, which bites at exchange.** The second exchange fails and the admin generates another code. Do not add a partial index on `EnrolmentCode`: an expired code would then block a short code permanently, because the audit FK is `RESTRICT` and the row can never be deleted.

**Single-use, atomically (criterion 2), and "close enough" is not accepted here.** One transaction: `UPDATE "EnrolmentCode" SET consumed_at = now(), device_id = $2 WHERE id = $1 AND consumed_at IS NULL` — **zero rows affected is the refusal** — then the `Device` insert. A unique-violation on the code rolls the consumption back with it. **The test must run two genuinely concurrent exchanges and assert exactly one Device exists**, not two sequential calls; a sequential test passes against a design that mints two.

| Rank | Option | User ×2 | Bus ×1 | Eng ×3 | Rev ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Admin types 2–4 from a 33-symbol set; full unique index on `(tenant_id, store_id, code)`** | 4 (8) | 4 | 5 (15) | 4 (8) | 4 (8) | **43** |
| 2 | System generates the code from the Device name | 3 (6) | 4 | 3 (9) | 4 (8) | 3 (6) | **33** |
| 3 | Full alphanumerics, ambiguity resolved by a canonicalising generated column | 4 (8) | 4 | 3 (9) | 3 (6) | 3 (6) | **33** |

**2. Generated.** Removes the collision error from the admin's day entirely. It loses because the code is a mnemonic for a physical counter and prints on every receipt: `X7` for "Counter 2" is worse for the cashier holding the refund than typing `C2` once was for the admin. **3. Canonicalising column** (`translate(upper(code),'OIL','011')` `STORED`, unique on that). Keeps `OUT` as a code and closes the same hazard — genuinely elegant, and it lost by a hair on being one more thing in the schema to explain. **The one to move to if an admin ever needs a code the charset forbids.**

## Q5 — Both screens are the shipped pattern; the POS grows no shell and one field

### Back office — `devices-1440`

Route `apps/backoffice/src/routes/**/devices.tsx` (the nav entry already exists, record 022), feature `apps/backoffice/src/features/devices/`, `DeviceListCard.tsx` copied from `StoreListCard.tsx`. Components: `Card`, `ListToolbar`, `Table*`, `useTableView`, `TablePagination`, `Badge`, `Button`, `Sheet` (049) + `SheetForm` (050), `Dialog` (041), `Select`, `Input`. **Nothing new in `packages/ui`.** **Columns:** `Device` · `Code` · `Store` · `Last seen` · `Status` · `Actions` (sr-only). `Code` is inserted after `Device` because it is part of the Device's identity and prints on receipts; the mock's order is otherwise preserved. `Last seen` renders relative text (`2 min ago`) inside `<time dateTime={iso}>`, **computed once at render — no interval, nothing ticks**; `last_seen_at` defaults to `enrolled_at`, so `Never` is unreachable and is not built. **Not built, and each has an owner:** `Queue` and `⚠ stalled` (`offline-sync` telemetry that does not exist), `Release` and `⚠ old release` (`release-ops`), `review held` (`hardening`'s adjudication screen) — record 009 forbids a state that cannot be true, and all three would render empty forever.

**Every state the mock does not draw:**

| State | What it is |
| --- | --- |
| Hover / focus | `StoreListCard`'s row hover copied verbatim; the global `:focus-visible` (record 014). Neither is re-picked here. |
| Disabled | **None.** `Revoke` is *absent* on a revoked row, not disabled — 009's rule. `Rename` stays, because a revoked Device still names past sales. |
| Loading | `StoreListCard`'s pending treatment, copied. Buttons swap label: `Revoke` → `Revoking…` (040/054's shape). |
| Empty, unfiltered | **Built** — unlike 054's case this state is reachable: a new tenant has zero Devices. Copy: heading `No devices yet`, body `Enrol a terminal to start taking sales at the till`, with the `Enrol a device` action. |
| Empty, filtered | `StoreListCard`'s no-match state, copied, not re-decided. |
| Error | `Couldn't load devices` · `Couldn't revoke the device` · `Couldn't rename the device` — 054's failure-copy shape, no terminal full stop. |
| Live region | 038's existing region: `Code generated` · `Renamed` · `{name} revoked`. |

**The enrolment-code panel crosses the mock on placement only.** The mock draws a card below the table; 049 made the editor a detached non-modal sheet and this is the sixth screen to inherit that rather than the first to grow an inline panel. The form (`Store` select, `Name`, `Short code`) is the sheet; **on success the sheet's body is replaced by the result** — the code in large text, the Store, the expiry, and `Single-use. Enter it on the terminal.` The mock's content and its order are followed exactly. Expiry renders **`Expires in 10 minutes`, computed once**, with the absolute instant in `<time dateTime>`; the mock's `09:41` countdown is not built, because a per-second region is an interval to leak and a repeated announcement risk for the information an absolute time already carries. WCAG permits the underlying limit either way — SC 2.2.1's *"Essential Exception: The time limit is essential and extending it would invalidate the activity"* covers a single-use security code.

**At 390:** no breakpoint, no density switch (013), six columns inside `overflow-x-auto py-1`. SC 1.4.10's two-dimensional-content exception applies, as 054 established. Row action controls meet **SC 2.5.8 Target Size (Minimum), 24×24 CSS px**; if the shipped `Button` default does not, the fix is its existing larger `size` variant, never a new token.

### POS — `device-enrolment-1280`

**The shell is `apps/pos/src/components/AppShell.tsx` exactly as it stands** — `flex h-dvh flex-col bg-background text-foreground`, the wordmark header, `<main id="main-content">`. No new shell, no sidebar, no header change. Route `apps/pos/src/routes/enrol.tsx` → `apps/pos/src/features/enrolment/Enrolment.tsx` (ADR-0009: the route file holds no JSX). From `packages/ui`: `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`, `Input`, `Button`, and the `Toaster` already mounted in `main.tsx`. One centred `Card`, `w-full max-w-md`, inside the existing `<main>`.

**The mock and criterion 1 contradict each other, and the criterion wins.** The mock draws a `Name this terminal` field; criterion 1 says the *admin* supplies the name and the short code. The admin must, because the short code has to be unique within the Store and appears on receipts — a cashier cannot be handed that. **The POS screen has exactly one input: the enrolment code.** The mock's name field is not built.

**No pre-flight lookup procedure.** The mock shows `Store: Malabon` before submit, which would need an unauthenticated code→Store endpoint — a probe that maps guessed codes to Store names for no gain, since a wrong code consumes nothing and there is no burn-on-typo risk. Pre-submit, that slot renders the static line `The store and the terminal's name come from the code — they are not chosen here`; on success it renders `Counter 2 · Malabon`.

**Field:** one `<Input>`, label `Enrolment code`, `aria-describedby` a hint reading `Eight characters. Dashes and spaces are ignored`, with `autoComplete="off" autoCapitalize="characters" spellCheck={false}` and **no `maxLength`** (032's truncation rule). **Not eight segmented boxes** — a new component, and hostile to a screen reader. Normalised before send: strip whitespace and dashes, upper-case, map `I`/`L`→`1` and `O`→`0` (Crockford's decoding rule). **No TanStack Form in `apps/pos`** — record 037 is scoped to the back office, one field is a plain `<form>` with `useState`, and adding the dependency for it is refused.

**States:** submit `Enrol this terminal` → `Enrolling…`, disabled only while pending; `required` handles empty; hover and focus come from the shipped `Button`/`Input` and the global `:focus-visible`. Failure is a `role="alert"` block in the dashed strip's slot, one message at a time, and **one message covers all three causes: `That code is expired, already used, or not recognised`** — distinguishing them tells an attacker which codes exist. Success replaces the form with `This terminal is enrolled`, `Counter 2 · Malabon`, and `Continue`; a terminal already holding a token never sees this screen, because `terminal.me` runs on mount and routes to `/`. **At 390** the card is `w-full max-w-md` inside page padding and reflows with no breakpoint, and the submit button is full-width at every width — the mock's shape anyway.

| Rank | Option | User ×2 | Bus ×1 | Eng ×3 | Rev ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Shipped list pattern + existing `AppShell`; name and code set by the admin** | 5 (10) | 4 | 5 (15) | 5 (10) | 4 (8) | **47** |
| 2 | The mock literally: inline code panel, POS name field, ticking countdown | 3 (6) | 3 | 3 (9) | 4 (8) | 3 (6) | **32** |
| 3 | A POS-specific shell and form primitives sized for a till | 4 (8) | 3 | 1 (3) | 2 (4) | 1 (2) | **20** |

**2. The mock literally.** 3 on evidence because it is drawn, and it loses on the two contradictions above plus 049's shipped pattern — a name typed at the terminal cannot satisfy the per-Store uniqueness the same criterion demands. **3. A POS design system.** The POS will eventually need till-sized targets, and this screen is the wrong place to invent them for eleven later screens; that is a shared-component record with a human in it.

## Q6 — A fourth `Ctx` arm whose field is named `device`, and a guard the compiler enforces

Today `Ctx` is `{ db, resHeaders?, clientIp } & ({kind:"unauthenticated"} | {kind:"tenant"; principal} | {kind:"platform-admin"; platformAdmin})`, and twenty-one handlers open with `if (ctx.kind !== "tenant" || !ctx.principal.role) return null;`.

**The single most important call: the Device arm's field is `device`, not `principal`** — a fourth arm `{ kind: "device"; device: DevicePrincipal }` where `DevicePrincipal = { tenantId, deviceId, storeId, code, name }`. Because `principal` then exists on exactly one arm, **all twenty-one existing checks stay correct with zero edits**, and a handler that reaches for `ctx.principal` on a Device request does not compile. That is what "the two principals do not substitute for one another" has to mean to be enforceable: a type error, not a convention.

**How a procedure declares which principal it takes.** One new narrowing helper beside the existing pattern, `deviceCtx(ctx): (Ctx & {kind:"device"}) | null` in `packages/backend/src/common/ctx.ts`. A Device handler reads `ctx.device.storeId` and therefore **cannot** be written against the tenant arm; a cookie handler reads `ctx.principal.role` and cannot be written against the device arm. The declaration is the handler's own type. **No path allowlist** — `isMustChangePasswordExempt`'s shape is deliberately not copied, because a list is a second place to get it wrong and a cookie procedure wrongly added to one fails *open*.

**The `Origin` gate is a property of the credential, not of the procedure, and that is why the exemption cannot leak.** `apps/api/src/app.ts` already runs it only inside `if (sessionId)` — that is, only when a session cookie was actually parsed and is about to be used. A Device token never reaches it because no cookie is read. **Nothing in the gate needs to know which procedure is being called, so there is no per-procedure exemption to grant by accident.** Write that sentence into the file; it is the invariant.

Concretely, in files as they stand today:

| File | Change |
| --- | --- |
| `packages/backend/src/common/ctx.ts` | the fourth arm, `DevicePrincipal`, `deviceCtx` |
| `apps/api/src/context.ts` | `buildContextFromDeviceToken(db, token, clientIp)`, mirroring `buildContextFromSession` — hash, one-statement scoped lookup, refuse if absent or `revoked_at` is set, then touch `last_seen_at` inside `withTenantScope`. **Every refusal returns `unauthenticated`, never a distinguishable error.** `createContext` throws if more than one of the three actors is passed; `test-seam.ts` gains `.asDevice(...)`, mutually exclusive with the other two by construction. |
| `apps/api/src/app.ts` | the existing `isDeviceTokenRequest` branch calls it, after matching the `Bearer` scheme. The comment already sitting there for issue 09 becomes true. |
| `packages/contract/src/contract.ts` | **two keys, not one.** `device` = cookie/admin (`list`, `generateCode`, `rename`, `revoke`). `terminal` = the POS (`enrol`, unauthenticated; `me` and `heartbeat`, Device-token). Mixing both under one key is the confusion this question exists to prevent. |

**The pre-auth lookup follows 031 exactly**, because the tenant is unknown until the Device is found: `withDeviceTokenScope(db, tokenHash, …)` sets `app.device_token_hash`, the policy reads `CREATE POLICY "device_token_lookup" ON "Device" FOR SELECT USING ("token_hash" = nullif(current_setting('app.device_token_hash', true), ''))`, and **the transaction runs exactly one statement**. `terminal.enrol` needs the same treatment on `EnrolmentCode` via `app.enrolment_code`.

**Criterion 5 falls out for free and is locked:** no Device-token procedure accepts a `tenantId` or a `storeId` in its input, ever. Both come off `ctx.device`. `apps/api/tests/tenant-isolation-grep.test.ts` is the existing enforcement.

**Criterion 8's server half is one grant, not a code review.** After `REVOKE ALL ON "Device" FROM "deanpos_app"` and `GRANT SELECT, INSERT`, the update grant is **column-level and exactly these three columns**: `GRANT UPDATE ("name", "last_seen_at", "revoked_at") ON "Device" TO "deanpos_app";`. `store_id`, `tenant_id`, `code`, `token_hash` and `enrolled_at` are then immutable after insert, by the database, so no path can re-point a Device at another Store. **No `DELETE` grant, ever.**

| Rank | Option | User ×2 | Bus ×1 | Eng ×3 | Rev ×2 | Evid ×2 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Fourth `Ctx` arm, field named `device`; guard is the handler's own type; two contract keys** | 4 (8) | 5 | 5 (15) | 4 (8) | 4 (8) | **44** |
| 2 | Fourth arm reusing the field name `principal` with a widened type | 4 (8) | 4 | 2 (6) | 2 (4) | 2 (4) | **26** |
| 3 | A path-prefix allowlist in `app.ts`, as `isMustChangePasswordExempt` does | 3 (6) | 3 | 2 (6) | 4 (8) | 1 (2) | **25** |

**2. Reuse `principal`.** Reads better and is how most codebases do it. It loses hard: every one of the twenty-one `ctx.principal.role` checks becomes reachable with a Device principal underneath, the compiler stops objecting, and the failure is silent. **3. Allowlist.** Cheap and greppable, and it is the one option that fails *open* — a cookie procedure added to the list by mistake gets the Origin exemption and nothing catches it.

## Smaller calls, flagged reversible

1. **`Device.revoked_at TIMESTAMP(3) NULL`, not a boolean** — `Session.revoked_at` is the shipped convention and it carries *when* for free. Criterion 10 reads `revoked_at IS NOT NULL`.
2. **`ENROLMENT_CODE_TTL_MS = 10 * 60 * 1000`** in `packages/backend/src/devices/device-policy.ts`, sibling of `session-policy.ts` and `throttle-policy.ts`. Matches the mock's `09:41`.
3. **The enrolment code is 8 symbols from Crockford's 32-symbol alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`**, generated as `randomBytes(5)` split into eight 5-bit groups — **exactly 40 bits, uniform by construction, no rejection sampling and no reliance on `randomInt`'s bias claim**, which this record could not read from nodejs.org. Displayed grouped `F4K9 — 2X7M`; stored ungrouped.
4. **No throttle on `terminal.enrol`.** 40 bits × a 10-minute window × single-use is not brute-forcible at any realistic rate. `ponytail: no enrolment throttle. Add an 'enrol:<ip>' key to 033's SignInThrottle if the TTL lengthens, the alphabet shrinks, or logs show repeated failed exchanges.`
5. **The device list is `admin`-only and the route refuses**, per 046 §4 and 054's smaller call 1. Nav visibility is presentation, never enforcement.
6. **`terminal.heartbeat` is called once on POS mount; no interval is built** — every Device-token request already touches `last_seen_at` in `buildContextFromDeviceToken`, which satisfies criterion 9, and the periodic beat belongs to `offline-sync`'s loop. **Expired enrolment codes are never deleted and no sweep job exists**; the audit FK is `RESTRICT` and a spent row is a few dozen bytes.

## What must not be built

- **No pre-flight code→Store lookup procedure**, and no error distinguishing expired from consumed from unknown.
- **No `Name this terminal` field on the POS**, and no path that sets `Device.store_id` after insert — the column grant above is the enforcement.
- **No `Queue`/`Release` column, no `⚠` badge, no `review held` action; no segmented eight-box code input; and no interval, timer or countdown anywhere in this issue** — not the code expiry, not last-seen, not a heartbeat.
- **No second file reads `localStorage` for these keys** — `rg -n 'localStorage' apps/pos` must return `device-token.ts` and nothing else — and **`apps/pos` never sets `credentials: "include"`**, which structurally stops the POS presenting a cookie at all. **No auto-clear of local state on a refused request.**
- **No path allowlist deciding which procedures take a Device token**, and **`timingSafeEqual` is not added to the token path** — there is nothing in application code to compare, and adding it means replacing an index probe with a scan.

## How to turn it back

| What | Cost |
| --- | --- |
| Both screens: columns, copy, states, the absent panels | One commit under `apps/backoffice/src/features/devices/` and `apps/pos/src/features/enrolment/`. Free, permanently. |
| Token storage (Q3 → option 2 or 3) | `apps/pos/src/lib/device-token.ts` and one header line in `lib/orpc.ts`. **Measured, not estimated: two files.** The accessor module is what keeps it two. |
| Short code charset or length (Q4) | Widening the `CHECK` is additive. **Narrowing it is not, and after the first Order carries `C2-0421` it is a data migration across every Order** — this is the reversal cost that changes soonest, on the day `checkout` merges. |
| Token format or hash (Q2) | One module server-side, but **every enrolled terminal must be revoked and re-enrolled by hand at the counter.** Cheap today at zero Devices; that is the whole argument for getting it right now. |
| `DeviceAudit` (Q1) | Adding it is additive. Dropping it is non-additive, and once a tenant writes rows it is a data migration into whatever replaces it. |
| The fourth `Ctx` arm (Q6) | `rg -n 'kind === "device"|ctx\.device'` enumerates it. **Zero call sites today.** The naming rule is what stops that number reaching the twenty-one tenant handlers. |
| Formally, any of the above | Write a superseding record; flip this `Status:` to `overturned` with the date and reason; update both `LOG.md` lines; re-run the gate. |

## What should make you reverse this

- **A fourth area needs an audit trail** — then the escalation in Q1 has waited too long and the human's generalisation decision is overdue. Four tables is not a shape, it is a smell.
- **An admin needs a short code the charset forbids**, or two characters is not enough at a Store with many terminals — Q4's option 3 is the pre-decided successor and the generated column is one migration. **Trigger: the first admin who asks for `OUT`.**
- **The POS ships on hardware the operator does not control, or a third-party script is ever added to the POS origin.** Either voids Q3's argument outright, and the successor is option 3, not a different storage key. **This is the assumption I am least confident about**, because it depends on decisions `release-ops` has not made.
- **`release-ops` never ships a Content-Security-Policy for the POS origin.** Then the mitigation named in Q3 is a sentence rather than a control, and the honest statement is that the token rests on the absence of injected script and nothing else.
- **SHA-256 stops being a sound preimage assumption**, or someone proposes replacing the index probe with an iterating comparison — the second is far likelier and is why it has a no-go. **A cookie procedure ever reached with `ctx.kind === "device"`** is the naming rule having failed, and it should be a compile error long before it is a runtime one.
- **Two concurrent exchanges are ever observed minting two Devices.** The conditional `UPDATE` is standard, but I did not execute it, and the concurrent test is the only thing that proves it.

## Evidence

**Repository, read 2026-08-03, main checkout (branch `main`):**

- The issue (thirteen criteria; *"Uniqueness is enforced at enrolment, per Store"*; the service worker and IndexedDB excluded as `offline-sync`'s) and **both SVGs read in full** — every column header and row, the enrolment panel's five lines, both dashed notes, the POS's `Name this terminal` field and its pre-submit `Store: Malabon`. **The two contradictions with criterion 1 are in the POS file.**
- `docs/adr/0007` (quoted above), `0008`, `0009` (**no route file contains JSX**), `0006` (expand/contract — the mechanism the Q1 escalation would use).
- `apps/api/src/app.ts` and `src/context.ts` in full — the `isDeviceTokenRequest` branch with its existing issue-09 comment, and **the `if (sessionId)` scoping of the Origin gate, which is the fact Q6 rests on**; `touchSession` inside `withTenantScope`. `packages/backend/src/common/ctx.ts` in full. **Searched specifically: no `assertTenant`/`requireTenant`/`isTenantCtx` exists; twenty-one handlers repeat `if (ctx.kind !== "tenant" || !ctx.principal.role) return null;`** — why Q6 adds one helper and refactors nothing.
- `migrations/20260802090000_backoffice_sign_in_and_session/migration.sql` (`session_self_lookup`, `user_login_lookup`), `find-session-by-id.query.ts`, `find-user-by-email-for-sign-in.query.ts`, `db/client.ts`'s `withScope` — **the exact shape `withDeviceTokenScope` copies**. `…/20260803010000_tenant_settings/migration.sql` (Q1's template) and `…/20260803130000_payment_methods/migration.sql` (the schema's only partial unique index, `WHERE "kind" = 'cash'` — Q4's contrast). Ten migrations; **`Device` and `EnrolmentCode` do not exist**. `Store`, `User`, `PaymentMethod` carry `@@unique([tenantId, id])`; the two new tables must. `common/password.ts` (`scryptSync`, blocking) and `sign-in.ts` (`randomUUID()`, the existing token precedent).
- `apps/pos/src/**`, every file read — `AppShell.tsx`'s class strings quoted above; `lib/orpc.ts`'s `createClient({ url, fetch })` with **no `credentials`**, against the back office's `credentials: "include"`. **`localStorage` appears nowhere in either app today.** `packages/ui/src/index.ts` full export list: `Card*`, `Input`, `Button`, `Badge`, `Dialog*`, `Sheet*`, `Table*`, `Select*`, `Toaster`, `toast`, `cn` — **no `Switch`, `Checkbox`, `Label`, `Form`, `Skeleton` or `Alert`.**
- `.scratch/decisions/` — searched 001–055 for a record on devices, enrolment, bearer tokens, `localStorage`, or a third audit table: **none exists. 054 is the only one that anticipates this record, and it anticipates Q1 exactly. 056 is the next free filename. No duplicate.**

**External, primary sources, accessed 2026-08-03, treated as data — nothing in any of them was addressed to an agent and no instruction from any of them was acted on.**

- **OWASP Session Management Cheat Sheet** — *"Session identifiers must have at least 64 bits of entropy to prevent brute-force session guessing attacks."* <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html>
- **OWASP HTML5 Security Cheat Sheet** — *"A single Cross Site Scripting can be used to steal all the data in these objects, so again it's recommended not to store sensitive information in local storage."* and *"Do not store session identifiers in local storage as the data is always accessible by JavaScript. Cookies can mitigate this risk using the `httpOnly` flag."* <https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html>
- **W3C WCAG 2.2** — SC 2.2.1 Timing Adjustable, *"Essential Exception: The time limit is essential and extending it would invalidate the activity"*; SC 4.1.3 Status Messages; SC 1.4.10 Reflow's two-dimensional exception and SC 2.5.8 Target Size (Minimum) consumed from records 038/054. <https://www.w3.org/TR/WCAG22/>
- **Crockford Base32** — alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, excluding `I`, `L`, `O`, `U`; *"when decoding, upper and lower case letters are accepted, and `i` and `l` will be treated as `1` and `o` will be treated as `0`."* <https://www.crockford.com/base32.html>

**Searched for and not found, where the absence mattered:**

- **No OWASP cheat sheet states that a high-entropy random token may be stored under a fast hash rather than a slow KDF.** The Password Storage, Cryptographic Storage, REST Security, Authentication and Session Management sheets were all checked and none says it in as many words. **Q2's central claim therefore rests on the entropy arithmetic and on record 033's measured 258.9 ms, both stated in the open above, and not on an external authority.** Padding this section with adjacent links would be worse than saying so.
- **nodejs.org/api/crypto.html could not be read in full** — it truncated before the method sections, and `randomInt`'s "avoids modulo bias" sentence was only reachable via a mirror, so **smaller call 3 is designed not to depend on it**: a 32-symbol alphabet over whole 5-bit groups is uniform by construction. Likewise **no claim about IndexedDB's XSS exposure relative to Web Storage could be confirmed verbatim from OWASP** — the equivalence in Q3 is a same-origin-script argument, not a citation, and is labelled as such. And **no test in this repository asserts RLS coverage across tables** (record 033's finding, re-confirmed), which is why the new tables' policies and the column-level grant must be argued in prose and locked by their own tests.
