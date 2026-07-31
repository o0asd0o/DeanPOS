# Offline sync

- **Status:** ready-for-agent
- **Area:** 5 of 12 (`ORC2_BUILD_ORDER`)
- **Depends on:** `foundation`, `tenancy-identity`, `catalog`, `checkout`
- **Blocks:** `drawer-sessions`, `observability`, `hardening`

> **The highest-risk area in the plan** (ADR-0003). Everything it touches is money that
> has already been collected from a real customer.

## Problem Statement

After `checkout`, DeanPOS can take a sale — as long as the network is up. It is not. A
carinderia's internet drops during the lunch rush, the router reboots, the tablet wanders
out of Wi-Fi range behind the counter. Today every one of those stops the queue.

The requirement (ADR-0003) is that the terminal keeps selling with **no server at all**,
and reconciles when it comes back. That breaks three assumptions the terminal currently
makes:

**The menu comes from the server.** A cashier cannot wait on a request per tap, and cannot
sell at all if the catalog fetch fails.

**A completed sale goes to the server.** Right now, if the submit fails, the sale is lost —
after the customer has paid and walked away with their food.

**The browser will keep what we store.** It will not, necessarily. IndexedDB in a
non-persisted origin is evictable under storage pressure, and an evicted Outbox is
collected cash that no longer exists anywhere.

There is a fourth problem that is subtler and worse: **a sale that syncs twice is a sale
counted twice.** `checkout` made submission idempotent for exactly this reason, but
nothing exercises it yet.

## Solution

The terminal becomes a PWA that treats the network as an optimisation.

**Read side.** The app shell is precached by a service worker. The Store's catalog —
already a single versioned read-model payload from `catalog` — is cached in IndexedDB and
refreshed by comparing versions, not by re-downloading. The terminal renders entirely
from the cache; a network request never sits in the path of a tap.

**Write side.** Every completed sale, and every void, refund, and manager Override created
at the terminal, is written to a local **Outbox** in IndexedDB as part of the same
transaction that completes it on screen. **Nothing is ever "sent instead of queued"** —
the queue is the only path, online or off, so the offline case is not a special case that
gets tested less.

**Replay.** A background loop drains the Outbox in creation order, calling the idempotent
endpoints `checkout` built. Entries are removed only on a server acknowledgement. Failures
back off and retry forever; nothing is dropped because a retry limit was reached. A
revoked Device's entries are quarantined server-side per `tenancy-identity`, and the
terminal is told to stop and show it.

**Durability.** The app requests persistent storage on first run and treats a refusal as a
condition worth surfacing, because from that point on the Outbox is evictable.

**Honesty.** The cashier always sees the truth: online or offline, how many sales are
waiting, when the last successful sync was, and whether anything is stuck.

## User Stories

**Selling offline**

1. As a cashier, I want to complete a sale with no internet, so that an outage does not stop the queue.
2. As a cashier, I want the menu to be there instantly with no network, so that I can start selling the moment I unlock the terminal.
3. As a cashier, I want to take cash, compute change, and show a receipt entirely offline, so that the customer experience is unchanged.
4. As a cashier, I want an Order number on the receipt while offline, so that I can find the sale again later.
5. As a cashier, I want the terminal to load at all after being closed and reopened offline, so that a reboot mid-outage is survivable.
6. As a cashier, I want my draft order to survive a reload or a crash, so that a half-built basket is not lost in front of the customer.
7. As a manager, I want to void, refund, and approve overrides while offline, so that an outage does not stop me doing my job.
8. As a cashier, I want to unlock the terminal with my PIN while offline, so that a shift can start during an outage.

**Knowing what is happening**

9. As a cashier, I want to see clearly whether the terminal is online or offline, so that I am never guessing.
10. As a cashier, I want to see how many sales are waiting to sync, so that I know the terminal is holding money.
11. As a cashier, I want to see when the last successful sync happened, so that "waiting" and "broken" are distinguishable.
12. As a cashier, I want a visible warning if sales have been stuck for a long time, so that I raise it before end of day rather than after.
13. As a manager, I want to be told before closing up if the terminal still holds unsynced sales, so that I do not end the day with cash the system has not recorded.
14. As a cashier, I want the sync indicator to be unobtrusive while everything is fine, so that it does not compete with the sale screen.

**Syncing**

15. As a cashier, I want queued sales to upload automatically when the network returns, so that I do not have to remember to do anything.
16. As a cashier, I want to trigger a sync manually, so that I can confirm everything is clear before I hand over.
17. As an owner, I want a sale to be recorded exactly once no matter how many times the terminal retries, so that revenue is never double-counted.
18. As an owner, I want a void or refund to arrive after the Order it applies to, so that reversals are never orphaned.
19. As an owner, I want a failed upload to be retried indefinitely rather than discarded, so that collected cash is never silently lost.
20. As a cashier, I want retries to back off rather than hammer a dead connection, so that the tablet's battery survives the day.
21. As an owner, I want a sale taken during an outage to keep the price the customer actually paid, so that the receipt and the record agree.
22. As an owner, I want each sale to record when the terminal took it and when the server received it, so that a long outage is visible in the data rather than hidden.

**Catalog freshness**

23. As a cashier, I want menu changes to reach my terminal without me doing anything, so that a price change made in the office applies at the counter.
24. As a manager, I want to know a terminal is running a stale menu, so that I can chase it rather than discover it in the numbers.
25. As a cashier, I want a catalog refresh to never interrupt a sale in progress, so that a background update is invisible.
26. As a cashier, I want an availability toggle made in the office to reach my terminal promptly, so that I stop offering something we ran out of.

**Durability and safety**

27. As an owner, I want the terminal to ask the browser to keep its data permanently, so that queued sales are not evicted under storage pressure.
28. As an owner, I want to be warned if the browser refuses persistent storage, so that I know the terminal is running in a riskier mode.
29. As an owner, I want a warning if the device is running low on storage, so that I act before the Outbox is at risk.
30. As a cashier, I want a queued sale to survive closing the browser, restarting the tablet, and being offline for days, so that a long outage is not a loss.
31. As an owner, I want a revoked terminal to stop being able to sync, so that a stolen tablet cannot inject sales.
32. As an owner, I want sales queued on a terminal that was later revoked to be held for review rather than dropped, so that money genuinely collected is not simply erased.

**Updates**

33. As a cashier, I want a new version of the app to never interrupt a sale in progress, so that a deploy during service is harmless.
34. As a cashier, I want to be told when an update is ready and have it apply at a safe moment, so that I am not left on an old version forever either.
35. As an operator, I want a terminal to reach the current version without anyone visiting the store, so that a fix actually ships.

## Implementation Decisions

**The Outbox is the only write path.** `checkout`'s completion step writes to the Outbox;
a separate loop drains it. There is no "if online, post directly" branch. This is the
single most important structural decision in the area: a code path that only runs when the
network is down is a code path that is tested least and fails when it matters most.

**Local-first ordering.** The screen updates from local state, and the queue drains
behind it. A cashier never waits on a request, online or offline.

**Storage layout.** IndexedDB holds: the catalog cache with its version; the Outbox; the
current draft Order; the synced PIN hashes and lockout state from `tenancy-identity`; and
Device identity. The Device token's storage is `tenancy-identity`'s decision; this area
provides the persistence mechanism, not a second one.

**Outbox entry.** Each entry carries the client-generated UUID from `checkout`, an entry
kind (`order` | `void` | `refund`), the payload, the Device timestamp of creation, an
attempt count, the last error, and a status. Entries are immutable except for their
attempt bookkeeping.

**Replay is ordered per Device and dependency-aware.** Entries drain oldest-first. A
reversal whose Order has not yet been acknowledged is not sent ahead of it. If the server
rejects a reversal because it has never seen the Order, that is a retry, not a failure —
the two must never be dropped independently.

**Idempotency comes from `checkout`, not from here.** Replay may send the same entry any
number of times; the server's uniqueness constraint on the Order UUID is what makes that
safe. This area must not add a second deduplication scheme — one guarantee, one place.

**Nothing is ever dropped.** There is no maximum attempt count that discards an entry.
Retries back off exponentially with a ceiling (a few minutes) and jitter, and continue
indefinitely. An entry that keeps failing becomes *visible*, not *deleted*. The only
things that remove an entry are a server acknowledgement and a quarantine decision.

**Sync triggers.** The `online` event, application focus, a periodic timer while entries
are pending, and an explicit manual button. The Background Sync API is **not** used — it
is not available on every target browser and would become a path only some devices take.

**Catalog refresh.** A lightweight version check on the same triggers; the full payload is
fetched only when the version differs. Applying a new catalog **never mutates the draft
Order in progress** — a line already built keeps what it captured, per ADR-0003's recorded
price. The terminal surfaces "menu updated" rather than silently changing prices under the
cashier's hands.

**Two timestamps, always.** Every Order carries the Device timestamp of payment and the
server timestamp of receipt. Device clocks drift and cannot be trusted; the server's
cannot describe when the sale happened. Both are stored; `reporting` decides which it uses
and says so.

**Persistent storage.** `navigator.storage.persist()` is requested on first run. A refusal
is recorded and surfaced — not fatal, but the terminal is then in a mode where the browser
may evict collected cash, and the operator deserves to know. Storage estimates are checked
periodically and a low-space warning is raised.

**Revocation.** Per `tenancy-identity`, the server rejects a revoked Device and quarantines
its queued entries. The terminal handles that response by stopping replay, clearing nothing,
and displaying an unmissable state — the entries stay locally as evidence.

**Service worker.** Precaches the app shell so the terminal boots offline. API calls are
**not** cached by the service worker; data caching is IndexedDB's job, and mixing the two
produces stale responses nobody can explain. Update policy: a new worker installs but does
not activate mid-session; the cashier is prompted and it applies at a safe moment, with a
forced application if the terminal sits idle. A sale in progress is never interrupted.

**The back-office is not offline-capable**, has no service worker, and is out of scope
here.

## Testing Decisions

**Two seams now.** This is the only area in the plan that adds one, and the addition was
deferred here deliberately from `foundation` so the cost lands where the value is.

1. **The in-process seam** (`foundation`) — rendered route → oRPC → Hono → Kysely → real
   PostgreSQL. Used for everything that is logic rather than browser behaviour: Outbox
   ordering rules, backoff computation, version-comparison logic, replay dependency rules,
   server-side quarantine of a revoked Device.
2. **The browser seam** — **Vitest browser mode with the Playwright provider**, confirmed
   with the developer. Real Chromium, real IndexedDB, real service worker, one runner and
   one set of assertions for the whole repo.

**Browser-seam scope is deliberately narrow: the offline money path only.** Confirmed with
the developer. Every POS screen is *not* re-tested in the browser — the in-process seam
already covers rendering and behaviour, and a large slow suite is the one teams stop
running.

**The browser-seam tests, in full.** This list is the acceptance contract for the seam:

- Go offline mid-session, complete a cash sale, and see a receipt.
- Reload the tab while offline; the queued sale is still there and the draft is intact.
- Close and reopen the application entirely while offline; the terminal boots and sells.
- Come back online; the sale uploads and lands **exactly once**.
- Come back online with several queued sales, and a void that applies to one of them;
  everything lands once, and the void lands after its Order.
- Interrupt a replay mid-flight (go offline again during upload) and assert the retry
  lands exactly one Order — the double-submit case that actually happens in production.
- Trigger eviction pressure and assert the persistence request was made; assert the
  refusal path surfaces a warning rather than failing silently.
- Replay from a Device revoked while it was offline: replay stops, the entries remain
  locally, the state is visible, and the server holds them quarantined.
- Unlock with a PIN while offline, including the lockout persisting across a reload.

**Prior art and fixtures.** Reuse the catalog fixture from `catalog` (*Ulam → Adobo/Munggo
→ Whole/Half → Extra rice*) and the actors from `tenancy-identity`. Do not seed a second
canonical menu.

**Property-tested.** Replay ordering: for any generated sequence of Orders and reversals,
draining the Outbox never sends a reversal before its Order, and the multiset of
server-acknowledged entries equals the multiset created, regardless of how many failures
and retries are injected. This is where "exactly once" is proven in general rather than by
example.

**What makes a good test here.** Assert what the cashier and the database can observe:
a receipt appeared, one row exists, the queue is empty, the indicator says synced. Never
assert that a retry function was called with a particular delay — assert that after N
failures the entry is still present and still retrying.

**Deliberately not tested here.** Aggregate reporting over device-versus-server timestamps
— `reporting`. Alerting on a stalled Outbox — `observability` (this area exposes the
signal; that area watches it). DrawerSession close with unsynced entries —
`drawer-sessions` consumes the state this area publishes.

## Security Criteria

1. **A revoked Device cannot sync**, and the check happens on every replay request, not
   only at unlock.
2. **Quarantined entries are held, never silently accepted and never silently dropped** —
   they represent cash a customer really handed over.
3. **The Device token is the only thing that establishes Tenant and Store on replay.** A
   replayed payload may not name its own Tenant, Store, or Device.
4. **Everything the terminal asserts while offline is a claim, not a fact.** The server
   re-validates composition, re-verifies offline Overrides against role and Store
   membership as of then, and still stores the recorded price (ADR-0003).
   **This area calls `tenancy-identity`'s re-verification procedure; it does not
   reimplement the check.** That area builds and unit-tests the procedure directly because
   it cannot depend on a replay endpoint that does not exist yet; this area is where it is
   finally exercised through a real Outbox replay, and that end-to-end path is this PRD's
   to prove.
5. **Replay is authenticated per request.** A queued entry does not carry a cached
   authorisation decision that outlives the Device's validity.
6. **The Outbox is device-local and Store-scoped.** It never contains another Store's data,
   and the catalog cache contains only what that Store may sell.
7. **Nothing sensitive is written to IndexedDB beyond what `tenancy-identity` already
   sanctioned** — PIN hashes for that Store only, never password hashes, never other
   Stores' users.
8. **A shared or lost tablet is the threat model.** Locking the terminal must not require
   the network, and the lockout state must survive a reload — otherwise the lock is
   theatre.
9. **Untrusted input on the server side includes everything replayed**, including
   timestamps. A Device timestamp is stored as *what the device claimed*, never used to
   authorise anything, and never allowed to overwrite the server's own receipt time.
10. **Never logged:** Outbox payloads, tendered amounts, PIN hashes, Device tokens. Log
    entry UUID, kind, attempt count, and outcome.
11. **Clearing local data is an explicit, audited action**, not something an error handler
    does on a whim. No code path may delete an unacknowledged Outbox entry.

## Out of Scope

- Anything the back-office does. It has no service worker and no offline mode, by decision.
- Offline catalog *editing*. The terminal caches the catalog read-only; management stays
  online-only in `catalog`.
- Multi-device conflict resolution. Sales are append-only and Device-scoped, so there is no
  conflict to resolve — this is why ADR-0003 rejected a replication engine. If two Devices
  could edit one record, that would be a new decision, not a feature of this area.
- Server re-pricing of replayed Orders. Explicitly forbidden by ADR-0003.
- Push notifications and background periodic sync.
- Alerting when an Outbox stalls — `observability` watches the signal this area exposes.
- DrawerSession behaviour with unsynced entries — `drawer-sessions`.
- Reporting over device-versus-server timestamps — `reporting`.
- Offline support for the landing site.
- Peer-to-peer sync between terminals in the same store. Not v1, and a large design
  question if it ever is.

## Further Notes

- **The one line to hold on to:** the Outbox is not a fallback, it is the write path.
  Every deviation from that turns the offline case into a rarely-exercised branch.
- **"Exactly once" is the acceptance criterion for the whole area.** If the property test
  over injected failures does not hold, nothing else here matters.
- **Eviction is the failure mode nobody predicts.** A tablet running low on space can drop
  an entire origin's IndexedDB. Persistent storage is requested, its refusal is surfaced,
  and low space is warned about — three cheap things that together prevent the worst
  outcome DeanPOS can produce.
- **Do not add a retry limit.** Discarding an entry after N attempts destroys collected
  cash to make a dashboard look tidier. Make it visible instead.
- **Do not cache API responses in the service worker.** IndexedDB owns data; the worker
  owns the shell. Mixing them produces stale reads that are extremely hard to reason about.
- **The browser suite will be slow.** Keep it to the money path so it stays fast enough to
  actually run in the gate. If it grows past that, that growth needs a reason.
- A terminal that has been offline for days and comes back mid-service will replay a
  large queue. Backoff, ordering, and the visible progress state should be designed for
  that case, not just for the two-minute outage.

## Comments

_Specification derived from the `/plan-app` grilling session of 2026-07-31 and ADR-0003,
ADR-0005, ADR-0007. Browser seam (Vitest browser mode, Playwright provider) and its narrow
scope confirmed with the developer before writing._
