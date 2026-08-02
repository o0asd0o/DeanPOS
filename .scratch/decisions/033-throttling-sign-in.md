# 033: Throttling sign-in — one PostgreSQL table, two keys, checked before the hash; and issue 11 does not get to own this

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** human (delegated back from `.scratch/decisions/030-the-back-office-sign-in-screen.md`, which refused it; originally `.scratch/tenancy-identity/issues/03-backoffice-sign-in-and-session.md`)

## The question

Sign-in is merged and live and an attacker may call it as fast as they like,
forever. What limits them, where does that limit live, and how does it avoid
telling them which email addresses exist?

A wrong answer costs three different things, which is why this is one record and
not three. Too loose and a back office is guessable. Too tight and a stranger who
knows an owner's email address can lock that owner out of their own restaurant,
in a product with no self-service password reset. And a limit that behaves
differently for an address that exists than for one that does not hands over a
staff directory — which is exactly what issue 03's merged criterion 5 forbids.

**The human's direction, which I was asked to test rather than adopt:** throttle
per-IP **and** per-account; return the same `Email or password is incorrect` with
no distinct lockout message; and **fold this into issue 11's mechanism** rather
than build a second one.

Two of those three are adopted. The third is refuted.

### Weights, declared before any option was scored

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×2 | The common case is invisible. The uncommon case — a legitimate admin refused on a product with no self-service reset — is a phone call, and record 030 already priced that. |
| Business impact | ×1 | Nothing earns. The business fact is the same phone call. |
| Engineering cost and risk | ×3 | This is where the question lives. A new branch on a live authentication path, a new table under a schema whose whole thesis is row-level security, an IP address whose source is spoofable, and two merged acceptance criteria that must survive. Every way this goes wrong is an engineering-risk way. |
| Reversibility | ×2 | A migration, which record 027's freeze rule makes the expensive artefact in this repository once applied. Scored explicitly for that reason. |
| Evidence strength | ×2 | The standards give a hard number for one half of the answer and nothing at all for the other half, and that asymmetry has to be visible rather than smoothed over. |

Maximum possible total: 50. **Not changed after scoring.**

## What I chose, and why

**One table in PostgreSQL, keyed by a string. Two keys per attempt — the
submitted email and the client address. Both checked in one query *before* the
password is hashed. The refusal is byte-identical to a wrong password. Locks are
temporary and lift themselves. Nothing is shared with issue 11 except the table
and a naming convention.**

### First, the thing I disagree with the human about: this cannot wait for issue 11

Issue 11 is `ready-for-agent` and depends on issue 10, which depends on issues 09
and 06, which depends on 05. Folding password throttling into issue 11 means
**sign-in stays completely unthrottled for five more issues.** That alone settles
it, and everything below is why sharing would not have been right even if the
ordering were reversed.

**They are not the same mechanism, and the word "throttle" is the only thing they
share.** Issue 11's three load-bearing criteria are:

> "The lockout is enforced on the Device, persists across a page reload, and
> **works with no network** … Throttling applies per Device, so it cannot be reset
> by trying a different User's PIN."

A lockout that must work with no network cannot live in PostgreSQL. It lives in
durable browser storage on a tablet. Meanwhile a password attacker is not using
the browser at all — they are posting to `/rpc` with `curl` — so **client-side
state is worth exactly nothing** on the password path and the counter must be
server-side and shared across every client.

So a shared abstraction would have to span an offline client store and a server
database, with different key spaces (a Device id versus an email string and an
address), different thresholds, different reset rules, and — the sharpest
difference — **opposite visibility requirements**:

- Issue 11's criterion 1: *"the lock is visible and says when it lifts."*
- Record 030's rule, and issue 03's criterion 5: the password lock must be
  **indistinguishable from a wrong password** and may never announce itself.

Those two are direct contradictions of each other, and both are correct. The PIN
case has no enumeration concern — the cashier is standing at an enrolled Device
whose synced payload already contains that Store's user list, so telling them the
terminal is locked reveals nothing they could not already see. The password case
is a public endpoint reachable by anyone. **One mechanism serving both would have
to carry a flag saying which kind of security it is doing today, which is how the
wrong branch gets taken.** Sharing here is a false economy.

**What issue 11 does inherit, and it is worth more than an abstraction would
be:** issue 11's Relevant files already name *"the server-side counterpart for
online attempts"*. That counterpart gets **this same table, under a different key
prefix** — `pin:<deviceId>` beside `email:<address>` and `ip:<address>` — plus the
three rules that generalise: locks are temporary and self-lifting, the check runs
before the expensive operation, and the key is the string the caller supplied
rather than a row that was found. Issue 11's *Device-side offline* lockout is
built separately because it must be. **No criterion of issue 11 changes**; only
the orchestrator note in its Comments, which currently says the scope may widen to
cover passwords, needs correcting.

### The enumeration trap, and the rule that dissolves it

This is the part record 030 named and the part an implementer is most likely to
get wrong, so it gets stated as a rule rather than as a warning.

> **Response time may vary with what the client sent. It may never vary with what
> the server knows.**

Issue 03's criterion 5 demands that an unknown email and a wrong password be
identical in message and in timing. The merged code satisfies it honestly:

```ts
const user = await findUserByEmailForSignIn(ctx.db, input.email);
const passwordOk = await verifyPassword(
  input.password,
  user?.password_hash ?? DUMMY_PASSWORD_HASH,
);
```

`verifyPassword` runs exactly once whether or not the account exists. A throttle
that short-circuits before that call creates a fast path — and record 030 warned
that a fast path is a new oracle on the same route.

**It is not one, and the reason is the key.** The counter is keyed on the
**submitted email string**, not on a `User` row. It is created and incremented for
`nobody@example.com` in precisely the same way as for a real administrator's
address, because the code that increments it never looks at whether a user was
found. So a throttled response is fast for both, and the only information the fast
path carries is *"this string has been tried recently"* — which the attacker put
there themselves. There is nothing to learn.

That single property is what makes the whole design legal, and it is one refactor
away from being destroyed:

> **No-go, and the most important line in this record: the failure counter is
> incremented for every failed sign-in, whether or not the email matches a User.**
> An implementer who "optimises" this to only count attempts against real accounts
> converts the throttle into a perfect account-enumeration oracle — one fast
> response means the address does not exist — and every one of issue 03's timing
> tests still passes, because they measure the unthrottled path.

The regression lock is a test that drives an unknown address past the threshold
and asserts it is throttled. It is cheap and it is the only thing standing between
this design and its inverse.

Two supporting constraints fall out:

- **The throttle lookup touches only the throttle table.** It never joins to
  `User` and never runs inside `withLoginScope`, so its cost is the same for an
  address that exists and one that does not. It also stays outside record 031's
  "a pre-auth transaction runs exactly one statement" rule by not being in one.
- **The throttled response is byte-identical to a wrong password**: the same
  `{ ok: false }`, the same HTTP status, the same headers. **No 429. No
  `Retry-After`. No distinct error code. No distinct message.** Record 030 wrote
  this rule before the mechanism existed and it is honoured literally. The client
  renders `Email or password is incorrect`, which record 030 already fixed as
  covering "any future lockout or rate-limit refusal".

### The denial-of-service surface is real, and it is not the one record 028
### predicted

Record 028's re-check trigger said 128 MiB per hash would become an operational
problem on a login path. Having read the merged code, **the memory half of that is
already bounded and the latency half is not, which is the opposite of the obvious
reading.**

`packages/backend/src/common/password.ts` uses **`scryptSync`** — the blocking
variant. A blocking call on a single-threaded runtime cannot overlap with itself,
so peak memory is 128 MiB, not 128 MiB times the number of concurrent requests.
There is no OOM to defend against and **no concurrency limiter is needed; adding
one would limit a concurrency that cannot occur.**

What is unbounded is worse. Every sign-in attempt blocks the **entire API process**
for the full duration of one scrypt derivation — health checks, POS traffic, every
other tenant. So an attacker with one machine and a `for` loop does not need to
guess anything; they just keep the event loop busy. **The throttle is not a
hardening nicety here. It is the only thing that keeps the API responsive.**

That settles the ordering question the human asked:

> **The throttle check runs before the hash. Not after, not alongside.**

Checking after the hash would mean the attack has already been paid for by the
time it is refused, which is the same as having no throttle at all for this
purpose. And per the rule above, running it first costs nothing in enumeration
terms because the short-circuit is keyed on a string the attacker chose.

**One concrete obligation, because I could not measure it and it is the number
everything else rests on: the implementer must time one `verifyPassword` call
under `bun` on the target host and write the figure into the build report.** That
figure is the per-request block time of the whole API, and if it turns out to be
in the hundreds of milliseconds it is a stronger argument for moving to the async
`crypto.scrypt` than anything in this record. That move is the pre-decided
successor and it needs no change to the throttle.

### Where the state lives: PostgreSQL, one table, no tenant

There is no cache and no queue in this project, adding one is a dependency
decision with its own record, and the ladder's answer is the engine already here.

```sql
CREATE TABLE "SignInThrottle" (
    "key"          TEXT NOT NULL,
    "failures"     INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SignInThrottle_pkey" PRIMARY KEY ("key")
);

REVOKE ALL ON "SignInThrottle" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON "SignInThrottle" TO "deanpos_app";
```

The primary key is the whole index; nothing else is needed.

**Why this table has no row-level security, stated up front because a reviewer
will stop on it.** The PRD's security criterion 2 is scoped precisely: *"RLS is
`ENABLED` and `FORCED` on every **tenant-owned** table"*. This table is not
tenant-owned. It has no `tenant_id`, no `user_id`, no foreign key, and its rows
exist for addresses that belong to no account at all — a counter for
`nobody@example.com` has no tenant to belong to. Enabling RLS with a
`USING (true)` policy would be theatre that a later reader mistakes for a real
control.

> **No-go: this table never gains a `tenant_id`, a `user_id`, or a foreign key.**
> The day it needs one it is tenant-owned data, it needs RLS and a policy, and it
> needs a new record. This sentence is the whole reason the exemption is safe.

**Why not in memory**, which is the laziest option and was ranked fourth rather
than dismissed: a map keyed on attacker-supplied strings is itself a
memory-exhaustion surface, so it needs eviction logic — which is roughly the same
amount of code as the migration it was avoiding — and every deploy silently clears
every lock, and the day a second API container exists the throttle halves with no
test failing. PostgreSQL gets durability across a deploy and unbounded key space
for free.

### The numbers, and which of them are cited and which are judgement

**Constants live in `packages/backend/src/auth/throttle-policy.ts`**, sibling of
the existing `session-policy.ts`:

```
EMAIL_FAILURE_LIMIT = 10
IP_FAILURE_LIMIT    = 30
THROTTLE_WINDOW_MS  = 30 * 60 * 1000
THROTTLE_LOCK_MS    = 30 * 60 * 1000
```

**Per email: ten consecutive failures, then that address is refused for thirty
minutes.**

- **Ten** is an order of magnitude below the only hard ceiling any standard
  states — SP 800-63B-4 §3.2.2: *"the verifier **SHALL** limit consecutive failed
  authentication attempts using a specific authenticator on a single subscriber
  account to no more than 100"*, with the document's own note that *"The limit of
  100 attempts is an upper bound, and agencies **MAY** impose lower limits."* It
  is also well above any plausible legitimate fumbling: a person who has typed
  their password wrong ten times running has forgotten it, not mistyped it.
- **Thirty minutes** sits inside NIST's own named example range for a waiting
  period — *"a period of time that increases as the subscriber account approaches
  its maximum allowance … (e.g., 30 seconds up to an hour)"* — toward the strict
  end. It is also **the number this repository already uses**:
  `SESSION_IDLE_TTL_MS` is thirty minutes, ratified by record 031. Reusing an
  existing decided constant beats introducing a second unit of time.

**Per client address: thirty failures within thirty minutes, then that address is
refused for thirty minutes.**

**This one is judgement and I am not going to dress it up.** No source I could
verify gives a per-IP number. The reasoning is: it must be strictly above the
per-email limit so that one account's legitimate fumbling can never trip it, and
three full per-email budgets from a single address in half an hour is not
something a restaurant office produces. It bounds one source to thirty blocking
hash operations per half hour, which is what keeps the API answering.

**The arithmetic that says these numbers are not too loose**, because the honest
worry with a self-lifting lock is that it caps nothing in the long run: ten
attempts per thirty minutes is 480 guesses a day, indefinitely. Against record
032's fifteen-character minimum with no composition rules, 480 a day for a year is
about 175,000 guesses — a rounding error against any fifteen-character string.
NIST's 100-then-disable is stricter in total, and the practical difference is nil.

**What I refused, deliberately: NIST's disable-after-100.** §3.2.2 says
*"Disabled authenticators **SHALL** be required to rebind to the subscriber
account to be usable in the future."* A permanent disable in this product means
any stranger who knows an administrator's email address can take a restaurant's
back office away, and the rebind path — self-service reset — **does not exist in
v1**. OWASP names exactly this trap: *"When designing an account lockout system,
care must be taken to prevent it from being used to cause a denial of service by
locking out other users' accounts"*, and its suggested mitigation — *"allow the
use of the forgotten password functionality to log in, even if the account is
locked out"* — is unavailable here. So the lock is temporary, always, and
**refusing that SHALL is a recorded deviation, not an oversight.**

### The algorithm, in the order it runs

1. Build two keys: `email:<trimmed, lowercased address>` and `ip:<address>`.
2. **One query:** `SELECT key FROM "SignInThrottle" WHERE key = ANY($1) AND locked_until > now()`.
   Any row returned → **return `{ ok: false }` immediately, before any hashing.**
3. Otherwise run the merged handler unchanged.
4. **On failure**, upsert both keys. `failures = failures + 1`, except that a row
   whose `updated_at` is older than `THROTTLE_WINDOW_MS` resets to `1` — otherwise
   someone who mistypes once a month is locked after ten months. On reaching the
   key's limit, set `locked_until = now() + THROTTLE_LOCK_MS` and reset `failures`
   to `0`, so the lock lifts to a fresh budget rather than escalating.
5. **On success**, delete the **email** key only. NIST: *"When the subscriber
   successfully authenticates, the verifier **SHOULD** disregard any previous
   failed attempts."* The **IP key is deliberately not cleared** — an address that
   has been spraying should not buy back its budget by finally guessing one
   account right.

`ponytail: no escalating backoff and no sweep of expired rows. Add escalation if logs ever show sustained hammering past a lock; add a sweep when the table gets large enough to notice.`

### Where the client address comes from, and the trap in it

Under record 011 the API sits behind Caddy in a container, so the socket peer is
always Caddy and the address must come from a forwarded header. **Trusting a
forwarded header as sent is a spoofing hole in both directions** — an attacker
rotates the value to escape the limit, or forges someone else's address to burn
their budget.

The fix is one line of proxy configuration rather than any parsing cleverness.
`docker/Caddyfile` currently reads `reverse_proxy api:3000` with no header
handling; it becomes:

```
api.{$APP_DOMAIN:deanpos.localhost} {
	reverse_proxy api:3000 {
		header_up X-Forwarded-For {http.request.remote.host}
	}
}
```

`header_up` with an explicit value **replaces** the header rather than appending
to it, so what the API receives is always exactly one address and always the one
Caddy actually saw. There is then nothing to parse and no "take the first or the
last element" question to get wrong — which is the form of this bug almost
everybody ships. **Record 011 is extended here, not overturned**: one directive
inside an existing site block, no new service, no new volume, no change to the
issuer logic or to `APP_DOMAIN`.

**When the header is absent** — `apps/api/src/dev.ts`, which runs with no proxy —
the key is the literal string `ip:no-forwarded-for`, so all such requests share
one bucket. It fails **closed**: anyone reaching the API without going through
Caddy is throttled together rather than exempted. That is the correct polarity and
it needs no `getConnInfo` and no second code path.

**The address reaches the handler on `Ctx`, never in the input.** `Ctx` gains one
field, `clientIp: string`, set in `apps/api/src/app.ts` for every request; the test
seam sets a fixed literal. Putting it in the procedure's input would make it
client-supplied, which is the thing issue 01's grep test exists to catch and which
record 031 spent a whole record undoing.

> **No-go: `clientIp` is used for throttling and for nothing else.** It is not a
> principal, it never reaches an authorisation decision, and it never keys a
> database session variable. Record 031's narrowed no-go covers the last of those
> and this sentence covers the first two.

### Exemptions, and what an operator can do

**There are no exemptions.** No IP allowlist, no platform-admin bypass, no
"disabled in development" flag. An allowlist is a new configuration surface whose
only function is to turn the control off, and a throttle that is off in the
environment where it is exercised is a throttle nobody has ever seen work.

**It is not disabled in tests either.** Tests that need many failures clear the
table between cases, the same way `auth-wrong-tenant-probe.test.ts` already seeds
and cleans its own pairs, and one test asserts the lock actually fires.

**What an operator can see or reset: nothing, on purpose, and that is why the lock
had to be temporary.** There is no admin screen in v1 and building one is a new
screen in a later area. A lock lifts by itself in thirty minutes and there is
nothing to call anybody about. Somebody with database access can
`DELETE FROM "SignInThrottle" WHERE key = 'email:someone@example.com';` — that is
the entire operator story, it is honest, and it adds no procedure, no permission
and no user interface.

**Nothing new is logged.** Issue 03's criterion forbids logging a password or a
session id; this record adds no log line at all, because a log of attempted email
addresses is a directory of guesses sitting in a log file. The table is the record.

## The options, ranked

| Rank | Option | User ×2 | Business ×1 | Eng cost/risk ×3 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ------- | ----------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **One PostgreSQL table, per-email and per-address keys, checked before the hash, temporary self-lifting locks; issue 11 shares the table and not the mechanism** | 4 (8) | 4 | 4 (12) | 4 (8) | 4 (8) | **40** |
| 2 | The same, but per-email only — no address key | 4 (8) | 4 | 3 (9) | 4 (8) | 5 (10) | **39** |
| 3 | In-process counters in a bounded map, no table and no migration | 3 (6) | 3 | 4 (12) | 5 (10) | 2 (4) | **35** |
| 4 | Defer again | 1 (2) | 1 | 3 (9) | 5 (10) | 1 (2) | **24** |
| 5 | Fold into issue 11 and build one mechanism for both credentials | 1 (2) | 2 | 2 (6) | 3 (6) | 2 (4) | **20** |

**1 — Both keys, in PostgreSQL. Chosen.** It is the only option that bounds both
threats the question actually contains: guessing one account's password, and
keeping the single-threaded API busy. Engineering 4 rather than 5 for the migration,
the `Ctx` field and the proxy line. Evidence 4 because half the numbers are cited
and half are judgement, and because NIST does bless the address half as an
additional technique — *"Leveraging other risk-based or adaptive authentication
techniques … (e.g., the use of the claimant's IP address …)"* — rather than as a
primary control, which is exactly how it is used here.

**2 — Per-email only. The genuine runner-up, one point back, and it wins on
evidence outright.** OWASP is unambiguous that the account is the right key:
*"The counter of failed logins should be associated with the account itself,
rather than the source IP address, in order to prevent an attacker from making
login attempts from a large number of different IP addresses."* Every number in
this option is cited and none is judged, which is why it scores 5 where the winner
scores 4. It is also simpler — the address key is the only part with a spoofing
question and a proxy configuration line attached.

It loses on one specific, demonstrable consequence rather than on principle. With
per-email counters only, an attacker sends sign-ins using a **fresh random address
every time**; no counter ever reaches its threshold, every request still runs a
blocking `scryptSync`, and one machine can hold the whole API down indefinitely.
OWASP is arguing that an address counter is not a *substitute* for an account
counter, and it is right; it is not arguing that the address counter is harmful.
Engineering 3 is that unbounded surface scored as risk rather than as cost.

**The honest statement: one point is not a separation, and the record should not
pretend otherwise.** Reversibility is identical, so the tie-break rule does not
reach it. Option 1 wins because it closes a hole option 2 leaves open, and if the
address key ever refuses a legitimate shared office, **dropping to option 2 is one
constant and one branch, and it is a cheaper move than adding the key later would
be.** That is the named trigger.

**3 — In-process counters, no migration.** Ranked third and it is the laziest
correct-looking answer, which is why it is scored rather than waved away: no
migration, no schema, no RLS conversation, and a reversal that is deleting one
file. Reversibility 5 is real. It loses on evidence and on two mechanical facts:
the map is keyed on attacker-supplied strings so it needs eviction logic, which
costs about what the migration costs and is easier to get wrong; and every deploy
under record 011 — `IMAGE_TAG=<sha> docker compose up -d` — silently clears every
lock. The second API container is the thing that would make it quietly stop
working with no test failing, which is the failure mode record 031 was written
about.

**4 — Defer again.** Ten of its 24 points are reversibility, the inflation every
do-nothing option gets for free and that records 002, 007, 008, 015, 028, 030 and
032 each left visible rather than tuning away. It is refuted by the tree: sign-in
is on `main`, it is unthrottled, and record 030 already deferred it once. Deferring
a second time after the human has delegated it means it gets designed at a keyboard,
and the enumeration property above is not something anyone reconstructs under time
pressure.

**5 — Fold into issue 11, as directed. Ranked last, and the reasons are in the
section above.** Sign-in stays unthrottled for five issues; the two lockouts have
contradictory visibility requirements, both correct; and one of them must work with
no network, so it cannot live where the other one must live. Engineering 2 because
the shared abstraction is *more* code than two purpose-built ones, not less —
which is the usual shape of a false economy. Reversibility 3 rather than 1 only
because most of it is unbuilt.

## What must change

### Merged code — yes, nine files, and one of them is a migration

| File | Change |
| --- | --- |
| `packages/backend/src/db/prisma/schema.prisma` | New `SignInThrottle` model. |
| `packages/backend/src/db/prisma/migrations/<new>/migration.sql` | The table and the grants above. **A new migration — the four existing ones are applied to `DeanPOS_dev` and are frozen under record 027.** |
| `packages/backend/src/auth/throttle-policy.ts` | **New.** The four constants. |
| `packages/backend/src/auth/db-operations/` | Two new operations: one query for the locked-key lookup, one command for the upsert, one for the success delete. Not inside any `withScope` helper. |
| `packages/backend/src/auth/handlers/sign-in.ts` | The pre-hash check, and the two write paths. The existing `DUMMY_PASSWORD_HASH` line and its comment are untouched. |
| `packages/backend/src/common/ctx.ts` | `clientIp: string` on `Ctx`. |
| `apps/api/src/context.ts` | Both constructors set it. |
| `apps/api/src/app.ts` | Reads the forwarded header once per request. |
| `apps/api/src/test-seam.ts` | A fixed literal. |
| `docker/Caddyfile` | The `header_up` directive. |

**No new dependency, no new service, no new engine, no lockfile change.** No
front-end file changes at all: record 030's error block already renders the one
sentence a throttled refusal produces.

### Acceptance criteria — none is weakened, and one Comment needs the human

- **Issue 03 is merged and `done`. Criterion 5 is not weakened — it is the
  constraint this record is built around**, and it gains a regression lock (an
  unknown address driven past the threshold is throttled identically to a known
  one). Criterion 8's "nothing logs a password or a session id" is unaffected; this
  record adds no log line.
- **Issue 11's criteria do not change.** Its Comments carry an orchestrator note
  saying *"the leading direction is to fold password throttling into this issue's
  mechanism … it may extend this issue's scope from PIN-only to both credentials."*
  **That note is now wrong and the human should correct it** to say the scope does
  not widen, that issue 11 reuses `SignInThrottle` under a `pin:` key prefix for
  its server-side online-attempt half, and that its Device-side offline lockout is
  its own mechanism because it must work with no network.
- **This record needs a home issue, and it can be the same follow-up as record
  032's** — the two are independent and either can ship alone, but they touch
  overlapping files and share a build report. Criteria to add:

  > - [ ] Repeated failed sign-ins for one email address are refused after a
  >       threshold, and the refusal is **identical in shape, status and message**
  >       to a wrong password — asserted for an address that exists **and** for one
  >       that does not, in the same test.
  > - [ ] The failure counter increments for an email that matches no User —
  >       asserted directly, because the opposite is an account-enumeration oracle.
  > - [ ] A throttled request does not reach the password hash — asserted, not
  >       assumed.
  > - [ ] Repeated failures from one client address are refused independently of
  >       the per-address account, and a request with no forwarded address is
  >       throttled rather than exempted.
  > - [ ] A lock lifts by itself after the configured period and a correct password
  >       then succeeds; a successful sign-in clears that address's counter.

  Issue 04 needs nothing from this record.

## No-gos

- **The counter increments for a failed sign-in whether or not the email matches a
  User.** The single line that keeps this design from being its own inverse.
- **The throttle check runs before the hash**, and touches only the throttle table.
- **The refusal is byte-identical to a wrong password.** No 429, no `Retry-After`,
  no distinct code, no distinct message, no distinct front-end treatment.
  Record 030's rule, honoured literally.
- **No permanent lockout and no lock that needs a human to lift it** while there is
  no self-service reset.
- **`SignInThrottle` never gains a `tenant_id`, a `user_id` or a foreign key.** The
  day it does, it is tenant-owned and needs RLS and a new record.
- **`clientIp` never reaches an authorisation decision** and never keys a database
  session variable.
- **No exemption of any kind** — no allowlist, no admin bypass, no environment flag.
- **No new cache, queue, or in-memory store.** PostgreSQL or a new decision record.
- **No client-side throttling, delay or debounce.** Record 030 already forbids
  client-side timing on this path and nothing here changes that.

## How to turn it back

**Before merge:** revert one commit across the ten files above. The migration has
been applied only to the lane's throwaway database, so under record 027's rule
there is nothing to unwind.

**After merge** — the case the reversibility score of 4 is measured against. A new
migration containing `DROP TABLE "SignInThrottle";`, plus deleting
`throttle-policy.ts`, the three db-operations, the branch in `sign-in.ts`, the
`Ctx` field and its three setters, and the `header_up` line. **No column is added
to an existing table, no data is backfilled, and nothing else in the schema
references it** — which is what keeps this a 4 rather than record 027's
"unwind a migration already merged" 1. The applied migration file is never edited.

**Dropping to option 2** — the likelier direction — is much cheaper than a full
reversal: delete `IP_FAILURE_LIMIT`, stop building the second key, and leave the
table and everything else in place. One constant and one branch.

**Measured call-site cost, not estimated.** The throttle is reachable from exactly
one handler, `sign-in.ts`, because it wraps the one procedure that verifies a
password. `clientIp` is the field with real reach — it appears on a shared type —
but it is a plain `string` with no library type in it, so the reversal cost is
`rg -n 'clientIp'`, which is four setters and one reader. The no-go above is what
stops that number growing.

**What will have been built on top of it by then.** Issue 11's server-side online
PIN counter, if it takes the key prefix as invited, and issue 09's device
enrolment if it wants the same shape. Neither imports anything from this record
except a string prefix and a table name, which is the point: there is no
abstraction to unpick, only a convention to stop following.

## What would make this decision wrong

- **The per-address limit refuses a legitimate shared office.** The most likely
  way this turns out wrong, the successor is pre-decided as option 2, and the move
  is one constant. **Named re-check trigger: the first report of a sign-in refused
  from an office where nobody had ten failures.**
- **One `verifyPassword` turns out to take long enough that thirty per half hour
  from one address is still a visible outage.** The number nobody has measured, and
  the obligation above is where it gets measured. If it is large, the successor is
  the async `crypto.scrypt` so the derivation stops blocking the event loop — a
  change inside `password.ts` that needs no change here, and one that would then
  make a concurrency limiter meaningful for the first time.
- **A second API container appears.** This design survives it — the counters are in
  PostgreSQL — which is exactly why option 3 lost. Worth naming because it is the
  event that would have quietly broken the cheaper answer.
- **Someone adds a second procedure that verifies a password.** Admin-initiated
  reset in issue 06 is the candidate. It inherits the same table and the same
  pre-hash rule, and if it instead grows its own counter this record has stopped
  being the single answer.
- **The forwarded header stops being what the proxy sets.** The whole address half
  rests on `header_up` replacing rather than appending. If record 011's Caddyfile
  is ever restructured — a second proxy, a CDN, a load balancer in front — the
  header is attacker-influenced again and the address key is worse than useless
  because it can be aimed. **Re-check trigger: anything added in front of Caddy.**
- **`{http.request.remote.host}` is not the correct placeholder spelling.** The
  directive's shape is standard Caddy and the shorthand `{remote_host}` is the
  commonly used alternative, but this record did not execute Caddy to confirm which
  resolves. The fixer must verify it against a running container before merging —
  a wrong placeholder yields an empty header, which fails closed into the
  `no-forwarded-for` bucket rather than failing open, but would silently make every
  request share one address budget.
- **`release-ops` never ships the breached-password blocklist.** NIST's own
  reasoning ties the two together: the blocklist should be *"of sufficient size to
  prevent subscribers from choosing passwords that attackers are likely to guess
  before reaching the attempt limit"*, and this record sets that limit at 480 a
  day. Records 032 and 033 are load-bearing for each other.

## Evidence

**Repository, read 2026-08-02, all absolute under the main checkout (branch
`main`, clean at `f8366ab`):**

- `packages/backend/src/auth/handlers/sign-in.ts` — read in full. **The finding
  that shapes the record:** `verifyPassword(input.password, user?.password_hash ?? DUMMY_PASSWORD_HASH)`
  runs unconditionally, so today every sign-in attempt — including one for an
  address that matches nothing — pays a full scrypt derivation. That is what makes
  the endpoint a latency amplifier and what makes pre-hash throttling mandatory
  rather than optional.
- `packages/backend/src/common/password.ts` — **`scryptSync`, the blocking
  variant.** The fact that corrects record 028's predicted failure mode: memory is
  bounded by serialisation, the event loop is not. `DUMMY_PASSWORD_HASH` is a fixed
  `$scrypt$ln=17,r=8,p=1$…` literal.
- `apps/api/src/app.ts` and `apps/api/src/context.ts` — read in full. The `/rpc/*`
  middleware is the one place a per-request value can be attached to `Ctx`; the
  `Authorization`-first branch for issue 09; the Origin gate. No request header
  other than `Cookie`, `Origin` and `Authorization` is read today.
- `packages/contract/src/contract.ts` — `signInOutputSchema` is a discriminated
  union whose false branch carries **no cause at all**, so a throttled refusal has
  an existing shape to return and needs no contract change.
- `packages/backend/src/auth/session-policy.ts` — two exported constants and a
  comment; the shape `throttle-policy.ts` copies, and the source of the thirty
  minutes this record reuses rather than reinvents.
- `packages/backend/src/db/prisma/migrations/` — four migrations, all applied to
  `DeanPOS_dev`, therefore frozen under record 027; the newest
  (`20260802090000_backoffice_sign_in_and_session`) read in full as the template
  for grants and comments.
- `apps/api/tests/tenant-isolation-grep.test.ts` — the client-input assertions
  (`.header(`, `.query(`, `hostname`, `searchParams`) that a forwarded header read
  must not trip, and the reason `clientIp` goes on `Ctx` from `app.ts` rather than
  into a procedure's input.
- **Searched specifically: no test anywhere enumerates tables or asserts RLS
  coverage.** The PRD's security criterion 2 (*"RLS is `ENABLED` and `FORCED` on
  every tenant-owned table"*) is review-enforced only. This matters twice — it is
  why the new table's exemption must be argued in prose rather than encoded, and it
  is why the no-go forbidding a `tenant_id` on it is the actual safeguard.
- `docker/Caddyfile` — `api.{$APP_DOMAIN:deanpos.localhost} { reverse_proxy api:3000 }`,
  **with no `header_up`, no `trusted_proxies` and no forwarded-header handling of
  any kind**. `docker-compose.yml` — read in full; **no memory limit on the `api`
  service**, which would have mattered had the memory reading of record 028's
  trigger been the right one.
- `.scratch/decisions/030-the-back-office-sign-in-screen.md` — the refusal this
  record discharges; *"any future lockout or rate-limit refusal"* already covered
  by the one error sentence; the named enumeration trap (*"a `Too many attempts,
  try again in 5 minutes` message is an oracle"*); the no-client-side-timing rule.
- `.scratch/decisions/028-password-hashing-runs-on-both-runtimes.md` — the 128 MiB
  figure and the explicit **"Re-check trigger: issue 03"**, which this record is
  discharging and partly correcting.
- `.scratch/decisions/031-how-a-query-with-no-tenant-reads-a-row.md` — the
  one-statement-per-pre-auth-transaction no-go; the narrowed second-session-variable
  no-go; the thirty-minute idle timeout; the "never supplied by a client" premise
  that governs where `clientIp` may and may not go.
- `.scratch/decisions/027-the-app-role-credential.md` — the applied-migration
  freeze rule, which is why this is a new migration and not an edit.
- `.scratch/decisions/011-local-stack-and-versioned-deploy.md` — Caddy as the one
  proxy, the four enumerated site blocks, and `IMAGE_TAG=<sha> docker compose up -d`
  as the deploy, which is what makes an in-process counter lose its state routinely.
- `.scratch/tenancy-identity/issues/11-pin-throttling-and-lockout.md` — read in
  full. *"The lockout is enforced on the Device, persists across a page reload, and
  works with no network"*; *"the lock is visible and says when it lifts"*;
  *"Throttling applies per Device"*; and the Relevant-files line naming *"the
  server-side counterpart for online attempts"*, which is the part that genuinely
  shares this table.
- `.scratch/tenancy-identity/issues/03-backoffice-sign-in-and-session.md` —
  `Status: done`, merged as `34964ed`; criterion 5 verbatim; the standing
  "Open, routed to the human" line this record closes.
- `.scratch/decisions/` — searched before writing for an existing or orphaned
  record on rate limiting, throttling, lockout, brute force or failed attempts:
  **001–032 exist, contiguous, no orphans; none decides this. 033 is the next free
  filename. No duplicate.**

**External, primary sources, accessed 2026-08-02.** Every page was treated as
data; none contained anything addressed to an agent, and no instruction from any of
them was acted on.

- **NIST SP 800-63B revision 4, final** —
  <https://pages.nist.gov/800-63-4/sp800-63b.html>,
  <https://csrc.nist.gov/pubs/sp/800/63/b/4/final>. §3.2.2 Rate Limiting
  (Throttling), quoted above: the SHALL limiting consecutive failed attempts *"to
  no more than 100 by disabling that authenticator"*; *"Disabled authenticators
  SHALL be required to rebind to the subscriber account to be usable in the
  future"*; the advisory note that *"The limit of 100 attempts is an upper bound,
  and agencies MAY impose lower limits"*; the three permitted additional
  techniques, including the waiting period *"(e.g., 30 seconds up to an hour)"*
  and *"the use of the claimant's IP address"*; and *"When the subscriber
  successfully authenticates, the verifier SHOULD disregard any previous failed
  attempts."* Also §3.1.1.2's blocklist paragraph, whose *"before reaching the
  attempt limit"* clause is what ties this record to record 032.
- **OWASP Authentication Cheat Sheet** —
  <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html> —
  the three lockout design factors (threshold, observation window, duration); *"The
  counter of failed logins should be associated with the account itself, rather than
  the source IP address, in order to prevent an attacker from making login attempts
  from a large number of different IP addresses"* — **the strongest argument for the
  runner-up, and the reason option 2 outscores the winner on evidence**; *"care must
  be taken to prevent it from being used to cause a denial of service by locking out
  other users' accounts"* with the forgotten-password mitigation this product does
  not have; and the generic-message rule requiring an identical response *"regardless
  of whether … the account is locked or disabled."*

**Searched for and not found, where the absence mattered:**

- **No standard I could verify gives a per-IP threshold.** PCI DSS v4.0 requirement
  8.3.4 was searched for specifically as a numeric anchor and **could not be read
  from a primary source** — the PCI SSC FAQ page returned an index rather than an
  answer, and the only numbers surfaced (six attempts, thirty minutes) were from a
  search summary of PCI DSS **v3**, not the current version. **They are therefore
  not cited anywhere in this record and no number here rests on PCI.** The per-IP
  figures are judgement, labelled as such, with a named trigger.
- **No source states the wall-clock cost of one scrypt derivation at `N=2^17, r=8`
  on this project's runtime and hardware.** It cannot be established without
  executing it, which is why it is written as an obligation on the implementer
  rather than asserted as a figure. It is the input the per-address threshold most
  depends on.
- **No test in this repository asserts RLS coverage across tables**, which is why
  the new table's lack of row-level security had to be argued rather than
  demonstrated.
</content>
</invoke>
