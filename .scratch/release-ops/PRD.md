# Release & operations

- **Status:** ready-for-agent
- **Area:** 10 of 12 (`ORC2_BUILD_ORDER`)
- **Depends on:** `foundation`, `observability`, `hardening`
- **Blocks:** nothing

## Problem Statement

DeanPOS can be built and it can be tested. It cannot be *shipped* — not repeatably, not by
somebody following a written procedure, and not with any way back if a release is wrong.

What is missing is everything between a green gate and a restaurant taking money:

**Deployment is an improvisation.** There is no defined artefact, no defined sequence, and
no verification that a deploy worked beyond opening the app and looking.

**Rollback is a theory.** ADR-0006 says rollback is redeploying the previous image, and
that property has never been demonstrated. A rollback story first exercised during an
incident is a rollback story that does not exist.

**Migrations can be shipped destructively.** Expand/contract is a discipline written in an
ADR, which means it holds until the first person in a hurry. Nothing mechanically stops a
`DROP COLUMN` shipping alongside the code that stopped using it.

**Terminals may never update.** The POS is a PWA with an aggressive cache and a service
worker. A deploy that does not deliberately handle cache invalidation reaches every
back-office and no terminal, and nobody notices for weeks.

**Backups do not exist, and "backup" is not the hard part anyway.** The hard part is
restore, and an unrehearsed restore is a hope. This is a product that holds other people's
takings.

**Nothing is written down.** When something breaks at 8pm during service, the response
depends on whoever is awake remembering how it works.

## Solution

A deliberately small operational surface, sized to one VPS and one operator.

**The artefact.** Each release is a versioned container image set, built for `linux/amd64`
regardless of the machine building it, tagged with a release identifier that reaches the
running app, the logs, and Sentry.

**The deploy.** One script, run against staging first and then production: pull the image,
apply migrations, restart, verify readiness, and stop with a clear failure if any step does
not pass. Deploys are not interactive beyond confirming.

**Rollback.** Redeploy the previous tag. Guaranteed to work because migrations are
forward-only expand/contract — and *proved* to work by a rehearsal that is a deliverable of
this PRD, not a paragraph in it.

**A migration safety check** in the gate that mechanically refuses destructive DDL unless a
release is explicitly marked as a contract step. The discipline stops depending on
attention.

**PWA cache invalidation** as part of every deploy, with a way to confirm a terminal
actually took the update.

**Backups and a rehearsed restore.** Nightly encrypted `pg_dump` to S3-compatible object
storage via rclone, and a restore script that has been run into a scratch database with its
output checked. The rehearsal is the deliverable; the backup is the easy half.

**A runbook** covering deploy, rollback, restore, secret rotation, mass device revocation,
quarantine adjudication, and one entry per alert from `observability`.

## User Stories

**Environments**

1. As an operator, I want a staging environment that mirrors production, so that a migration is exercised before it touches real takings.
2. As an operator, I want staging to hold realistic but non-real data, so that testing does not require a tenant's actual sales.
3. As an operator, I want staging and production to be configured identically apart from secrets and data, so that "it worked on staging" means something.
4. As an operator, I want the whole stack to run locally with no credentials, so that development never depends on a deployed environment.

**Releasing**

5. As an operator, I want each release to be an immutable versioned image, so that what I deploy is exactly what was tested.
6. As an operator, I want images built for the server's architecture regardless of my laptop's, so that a build does not fail on the VPS after passing at home.
7. As an operator, I want the release identifier visible in the app, the logs, and Sentry, so that any observation can be attributed to a version.
8. As an operator, I want deploying to be one command, so that the procedure cannot be half-remembered.
9. As an operator, I want the deploy to refuse to proceed when the gate has not passed on the exact commit being shipped, so that an untested build cannot reach production.
10. As an operator, I want the deploy to apply migrations before starting new code, so that the new code never meets an old schema.
11. As an operator, I want the deploy to verify readiness before declaring success, so that a broken release is caught by the script rather than by a cashier.
12. As an operator, I want the deploy to stop and say what failed, so that I am never guessing which step went wrong.
13. As an operator, I want to deploy to staging and production with the same script and a different target, so that the rehearsed path is the real path.

**Rolling back**

14. As an operator, I want to roll back by redeploying the previous version, so that recovery is one command under pressure.
15. As an operator, I want that rollback to be proven by a rehearsal, so that I am not discovering its behaviour during an incident.
16. As an operator, I want the previous version to run correctly against the current schema, so that rollback does not require a database change.
17. As an operator, I want a migration that would break that property to be rejected before it merges, so that the guarantee is structural rather than remembered.

**Migration safety**

18. As a reviewer, I want destructive DDL to fail the gate by default, so that expand/contract is enforced rather than intended.
19. As a reviewer, I want a contract-step migration to be possible with an explicit, visible marker, so that removal is deliberate and reviewable.
20. As an operator, I want migrations applied on staging before production every time, so that a failure happens where it costs nothing.
21. As an operator, I want to see which migrations are pending before I deploy, so that a release with a schema change is never a surprise.
22. As an operator, I want a migration failure to abort the deploy without starting new code, so that a half-applied release does not serve traffic.

**Terminals and updates**

23. As a cashier, I want my terminal to pick up a new release without anyone visiting the store, so that fixes actually reach me.
24. As a cashier, I want an update never to interrupt a sale in progress, so that a deploy during service is harmless.
25. As an operator, I want to see which release each terminal is running, so that I can tell whether an update landed.
26. As an operator, I want a terminal stuck on an old release to be visible, so that a broken cache is not invisible for weeks.

**Backup and restore**

27. As an owner, I want the database backed up nightly, so that a failure costs at most a day.
28. As an owner, I want backups stored off the VPS, so that losing the machine does not lose the data.
29. As an owner, I want backups encrypted, so that the storage provider is not trusted with our tenants' takings.
30. As an operator, I want old backups pruned on a schedule, so that storage cost stays bounded and predictable.
31. As an operator, I want a restore script I have actually run, so that recovery is a procedure rather than an experiment.
32. As an operator, I want the restore rehearsal to verify the restored data, so that a corrupt backup is discovered on a quiet Tuesday.
33. As an operator, I want to be alerted when a nightly backup fails, so that I do not find out during a recovery.
34. As an owner, I want the source code itself to exist somewhere other than one laptop, so that a lost machine is not a lost product.

**The runbook**

35. As an operator, I want written procedures for deploy, rollback, and restore, so that they can be followed at 8pm during service.
36. As an operator, I want one runbook entry per alert, so that an alert tells me what to do and not merely that something happened.
37. As an operator, I want written procedures for rotating each secret and for revoking a tenant's devices, so that a compromise response is a checklist.
38. As an operator, I want the runbook kept in the repository beside the code, so that it changes when the system does.
39. As an operator, I want a first-run procedure for standing up a fresh environment, so that rebuilding the VPS is a known quantity.

## Implementation Decisions

**There is no hosted CI, by decision.** The gate — `bun run check; bun run test` — is run by
the orc2 pipeline in a lane before anything merges, and by the deploy script against the
exact commit being shipped. This is coherent: the gate is enforced, just not by a hosted
service. The deploy script **refuses to deploy a commit whose gate has not passed on that
commit**, and refuses to deploy a dirty working tree. That refusal is what replaces the
missing CI, so it is not optional.

**The repository must be a git repository with at least one remote.** It is currently
neither. `foundation` initialises the repository; this area requires a remote to exist —
private, unattended, and used as an off-machine copy — because story 34 is otherwise
unsatisfiable and losing a laptop would lose the product. A remote is code custody; the
issue tracker stays local markdown as configured.

**Environments.** Two: staging and production, both as Docker Compose stacks, with staging
on the same VPS as a separate stack, separate database, and separate origins. This is a
compromise with a named ceiling — staging shares the machine's kernel, disk, and blast
radius with production, so it validates migrations and releases but not capacity. Documented
as such rather than pretended otherwise. **Upgrade path:** a second box when a second box is
affordable.

Staging data is generated, never a copy of production, since production holds other
businesses' takings.

**The release artefact.** Container images built for `linux/amd64` explicitly — the build
machine is a developer's Mac and the target is not, and an architecture mismatch produces a
confusing runtime failure rather than a build error. Images are tagged with a release
identifier derived from the commit; that identifier is baked into the app, reported in
device telemetry, sent to Sentry, and included in every log line's context.

**The deploy script**, one entry point with a target argument:

1. Refuse a dirty tree; refuse a commit without a passing gate.
2. Build and publish the images for the release.
3. Show pending migrations and require confirmation when there are any.
4. Apply migrations (`prisma migrate deploy`).
5. Abort without starting new code if migrations fail.
6. Start the new containers.
7. Poll readiness from `observability` until healthy or a timeout.
8. On timeout or failure, report clearly and leave the previous version's image present for
   an immediate rollback.

Rollback is the same script with a previous release identifier. It performs no database
change, which is exactly what ADR-0006's expand/contract discipline buys.

**The migration safety check** is a gate step that inspects migration SQL and fails on
destructive statements — `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN ... SET NOT NULL`
without a default, type narrowing, and destructive renames — unless the migration carries an
explicit contract-step marker in a header comment. The marker makes removal deliberate,
visible in the diff, and reviewable. This turns an ADR into a mechanism.

**PWA cache invalidation.** The service worker's precache is keyed to the release
identifier, so a deploy produces a new worker. Per `offline-sync`'s update policy, it
installs without interrupting a sale and applies at a safe moment. Device telemetry reports
the running release, so `observability`'s existing surface answers "did that terminal
update" — and a terminal stuck on an old release for longer than a threshold is visible
there.

**Backups.** Nightly `pg_dump`, encrypted before it leaves the machine, pushed with `rclone`
to S3-compatible object storage. Retention: seven daily, four weekly, monthly beyond that.
Pruning is automated. A failed backup raises an alert through the channel `observability`
already configured — a silent backup failure is the worst kind.

The repository itself is pushed to its remote as part of the same nightly job, satisfying
story 34 without a second mechanism.

**Restore, and the rehearsal.** A restore script takes a backup, decrypts it, and loads it
into a named scratch database. The **rehearsal is a deliverable of this PRD**: run it, load
the most recent backup, run verification queries (row counts per tenant, the most recent
Order, a reconciled DrawerSession), and record the result and the elapsed time in the
runbook. A backup nobody has restored is not a backup, and the elapsed time is what
somebody will need to quote to a tenant one day.

The rehearsal is repeated on a schedule and the runbook records the date of the last
successful one.

**The runbook** lives in the repository. It covers: first-run setup of a fresh environment,
deploy, rollback, restore, each secret's rotation, mass device revocation, quarantine
adjudication, and **one entry per alert** from `observability` — what it means, what to
check, what to do. Written to be followed by someone tired.

## Testing Decisions

**What makes a good test here.** Most of this area is scripts and procedures, and the honest
statement is that scripts are proven by **execution against a real target**, not by unit
tests of their internals. The testable parts are tested; the rest is rehearsed, and the
rehearsal produces a recorded result.

**Automated, in the gate.**

- **The migration safety check is a pure function over SQL text** and is tested thoroughly:
  each destructive statement type is rejected; each is accepted when the contract-step
  marker is present; a marker with no reason is rejected; safe additive migrations pass.
  This is the most valuable automated test in the area because it is the one enforcing
  ADR-0006 on every future change.
- **The deploy script's guard conditions** — dirty tree, gate not passed for the commit,
  unknown target — are tested as pure predicates.
- **Readiness polling** logic is tested against a stub that becomes healthy, never becomes
  healthy, and flaps.
- **Backup retention pruning** is a pure function over a list of dated artefacts and is
  tested for the seven/four/monthly rule, including boundaries.

**Rehearsed, and recorded rather than asserted.**

- A **full deploy to staging**, from a clean checkout.
- A **rollback rehearsal**: deploy release N, deploy N+1 including an expand migration, roll
  back to N, and verify N runs correctly against the migrated schema. This is the
  demonstration that ADR-0006's central promise is true; it is not complete until it has
  been performed and its result written into the runbook.
- A **restore rehearsal** into a scratch database with verification queries and a recorded
  elapsed time.
- A **terminal update check**: deploy a new release and confirm a real terminal reports the
  new release identifier in its telemetry.

Each rehearsal's outcome, date, and duration are recorded in the runbook. An issue for a
rehearsal is not closable on the basis that the script exists.

**Deliberately not tested.** Docker, rclone, and PostgreSQL themselves. VPS provisioning —
documented, not automated; infrastructure-as-code for one machine is a tool to maintain
rather than a problem solved. Capacity and load, which staging cannot answer honestly since
it shares the box.

## Security Criteria

1. **The deploy script never prints or logs a secret**, including in failure output where
   this is most likely.
2. **Backups are encrypted before leaving the machine.** The object storage provider holds
   ciphertext only; the key is not stored beside the backups.
3. **The backup encryption key's loss is a total loss** — its custody is documented in the
   runbook and it is not held solely on the VPS being backed up.
4. **Storage credentials are write-and-list scoped where the provider allows it**, so a
   compromised VPS cannot delete backup history.
5. **Staging never contains production data.** Copying a production dump into staging is
   prohibited, not discouraged — it would place real tenants' takings in a lower-trust
   environment.
6. **Staging is not publicly reachable** without authentication, and is excluded from search
   indexing.
7. **The git remote is private**, and the repository contains no secrets — verified by a
   gate check for known secret shapes, complementing `hardening`'s leak tests.
8. **Rollback does not bypass the gate.** A previous release identifier must correspond to a
   release that passed.
9. **The runbook contains procedures and locations, never secret values.**
10. **Untrusted input:** the deploy script's target and release arguments are validated
    against an allowlist, never interpolated into a shell command.

## Out of Scope

- Hosted CI. Decided against; the pipeline's lane gate plus the deploy script's refusal to
  ship an ungated commit is the mechanism. **Trigger to revisit:** a second person
  committing regularly, at which point local-gate discipline stops scaling.
- Infrastructure as code, configuration management, and automated VPS provisioning.
  Documented manual setup for one machine.
- Horizontal scaling, load balancing, and multi-region anything. One box, and the rate
  limiter in `hardening` is documented as sharing that assumption.
- Zero-downtime deploys. A few seconds of restart is acceptable; terminals hold their queue
  and keep selling, which is exactly what `offline-sync` was built for.
- Blue-green and canary releases.
- Point-in-time recovery and WAL archiving. **Deferred, trigger:** a tenant for whom losing
  a day's sales is unacceptable, which is a real conversation to have before self-serve
  signup.
- Automated failover and high availability.
- Load and capacity testing. Staging shares the box and cannot answer the question honestly.
- Status page and customer-facing incident communication.
- Cost monitoring.

## Further Notes

- **No CI is a real constraint and the deploy script is what compensates.** Its refusal to
  ship a dirty tree or an ungated commit is not a nicety — it is the only thing standing
  between "the gate passed" as a fact and as a claim. It should be the first thing built and
  the last thing anybody is allowed to add a `--force` to.
- **The repository has no remote today, and the entire product exists on one laptop.** That
  is the largest unmitigated risk in this PRD and the cheapest to fix.
- **The rollback rehearsal is the whole point of ADR-0006.** Until it has been performed,
  forward-only expand/contract is a paragraph rather than a property.
- **Restore, not backup.** The nightly dump is twenty lines. The rehearsal, its verification
  queries, and the recorded elapsed time are what make it worth having.
- **The architecture flag will bite exactly once** — building on a Mac for an amd64 VPS.
  Making it explicit in the build costs nothing and saves an hour of confusion.
- **Staging shares the VPS, and that is a stated ceiling, not a hidden one.** It validates
  migrations and releases. It cannot validate capacity, and nobody should be told otherwise.
- The runbook's alert entries are the payoff for `observability`'s discipline of only having
  four alerts. Four alerts, four procedures, each one actionable.

## Comments

_Specification derived from the `/plan-app` grilling session of 2026-07-31 and ADR-0001,
ADR-0004, ADR-0006. CI approach (none; gate enforced by the pipeline lane and the deploy
script) and backup destination (encrypted, rclone to S3-compatible storage) confirmed with
the developer before writing._
