# ADR-0007: Terminals are enrolled Devices; cashiers unlock with a PIN

- **Status:** accepted
- **Date:** 2026-07-31
- **Decided by:** human, in the app-wide planning session

## Context

A counter terminal is shared by several cashiers and must keep selling with no network
(ADR-0003). Email-and-password auth is unusable between customers and fails entirely
when a drawer session starts offline.

## Decision

- A terminal is **enrolled once** against a Tenant + Store by an admin, receiving a
  **long-lived Device token**. The Device — not the person — is what scopes every
  synced Order to a Tenant and Store.
- A **User unlocks the Device with a 4–6 digit PIN**. PIN hashes for that Store's Users
  sync to the Device so unlock works fully offline.
- Role (`cashier` / `manager` / `admin`) determines what may be **authorised**, not
  merely who is signed in. Manager Overrides (ADR-0005) are a PIN entry by a User
  holding the manager role, recorded against the action.
- The back-office uses ordinary email + password sessions. It is not offline-capable.

## Consequences

- **A stolen enrolled Device is the primary threat.** Remote Device revocation, and a
  server-side check on replay that a revoked Device's queued Orders are quarantined
  rather than silently accepted, are not optional.

  **Amended 2026-07-31.** They do not all belong to `hardening`, which owns no endpoint.
  The split is: `tenancy-identity` owns the `revoked` flag and the rule that every request
  checks it · `offline-sync` enforces that check on the replay endpoint it owns and writes
  the quarantine row · `hardening` owns the adjudication screen and the recorded decision.
  Three areas, three pieces, one owner each.
- PIN hashes at rest on the Device are a deliberate credential-exposure tradeoff, taken
  because offline unlock is a hard requirement. Mitigations: per-Store scope only,
  slow hash, PIN attempt throttling on-device.
- A 4–6 digit PIN is low-entropy by design. It is a **second factor to Device
  possession**, never a standalone credential — any path that accepts a PIN without a
  valid Device token is a defect.
- Device enrolment and revocation are admin-only and must be audited.

## Reversing it

Adding a stronger unlock (badge, longer PIN, biometric) is additive. Removing Device
enrolment is not viable — it is what makes tenant scoping of offline sales possible.
