---
name: plan-app
description: Plan a whole application from one app-wide question into a complete set of PRDs — foundation through release, security included — ready for /to-tickets and then the pipeline. Use on a greenfield repo, or whenever the pipeline has nothing agent-ready to run.
disable-model-invocation: true
---

# Plan the whole app

The pipeline in `.orc2/ORCHESTRATOR.md` builds tickets. It cannot invent them. On an empty repo the first move is not `/run-prd` — there is nothing to run — it is **one long grilling session about the whole application**, which becomes a set of PRDs, which become tickets.

This skill is the checklist for that session. It is user-only on purpose: an agent must not settle the stack, the threat model, or the release story on its own.

```
  /grill-with-docs  →  the PRD areas  →  /to-spec per area  →  /to-tickets  →  /run-prd
   (one session,        (this skill's      (one spec each)      (per PRD)      (per PRD)
    app-wide)            decomposition)
```

**Keep the grilling and the decomposition in one unbroken context window.** Do not compact until the areas are named and written down — that thinking is what makes the specs consistent with each other. Each `/to-spec` afterwards can start fresh.

## Step 0 — Make sure the skills below exist

Every `/name` this file tells you to run is a real skill that has to be installed. Check first, because the failure mode is silent: an uninstalled skill just does nothing, and it is easy to read that as "the step did not apply."

```
orc2 skills
```

That prints where each one lives — `global`, a path inside this project, or `missing`. If anything reads `missing`:

```
orc2 skills --global      # installs into ~/.claude/skills, for every project
orc2 render               # then drops the per-project copies that are now redundant
```

`orc2 init` already vendored a project-local copy of any planning skill you did not have, so in most cases they are present before you read this. `--global` is the better home if you plan to use them on more than one project — it also stops each project carrying a copy that quietly goes stale.

**Names differ between installs.** This file says `/to-spec` and `/to-tickets`; yours may be `/to-prd` and `/to-issues`. `orc2 skills` lists what you actually have — go by that, not by the names here.

## Step 1 — Grill the app-wide question

Open `/grill-with-docs` (it writes glossary entries and ADRs as it goes, which is the point — this session's output is a paper trail, not just a plan). Give it one app-wide question: **what is this application, and what has to be true for it to ship?**

The agenda below is what must come out with an answer. An unanswered item is not a gap to fill later — it is the thing that will stall a lane at 3am, so push until it is settled or explicitly deferred with a named trigger.

### Ask in batches. One question at a time is exhausting and mostly unnecessary

**Default to batching.** Most of this agenda is independent: the answer to "what is the deploy target" does not change what "who is untrusted" means. Independent questions go out **together, in one message** — three or four at a time, which is also the cap on the question tool.

**Serialise only across a real dependency**, meaning the earlier answer changes what the next question *is* or whether it is asked at all. The gates are marked in the agenda below; there are only five of them. Everything not behind a gate is batchable.

Rules for a batch:

- **Group by batch, not by topic.** Questions from different sections belong in one batch if none depends on the others. Do not walk the sections in order for tidiness — that reintroduces the serialisation the batching exists to avoid.
- **Lead each option with the recommendation** so it can be accepted in a word. Most answers here have an obvious default for the app in question; make the human confirm rather than compose.
- **One screen per batch.** Four questions with a one-line explainer each. If a batch needs a paragraph of setup to make sense, it is two batches, or it is behind a gate you missed.
- **Never batch a question whose answer you can read.** Check the repo, `.orc2/config.env`, and the existing decision records first. Asking what the gate command is when it is already in the config is how a grilling session loses the human's patience in the first two minutes.
- **Batch the follow-ups too.** When a gate opens, the questions behind it are usually independent of each other — send them as one batch, not as a new one-at-a-time chain.

The five real gates, and nothing else:

| Gate | Opens |
| --- | --- |
| Is there a user interface? | the whole Interface section |
| What are the core entities? | state machines, and which transitions are irreversible |
| Does the domain carry money, stock, or quota? | rounding, currency, and who may change a total |
| Who are the actors? | which boundaries exist, and what each one must authorise |
| What data is sensitive? | retention, deletion, and any regulatory constraint |

#### Batch A — the frame, and the two answers everything else gates on

Nothing here depends on anything. Send it as one batch; it opens three of the five gates.

- What is it, for whom, and what single job does it do? What is the one path that must never break?
- Non-goals. What are you deliberately not building? This is the highest-leverage answer in the session, because it is what stops scope creep becoming a finding in every review.
- What does "released" mean for this app — public, internal, invite-only, a demo?
- **Is there a user interface?** *(gate → Interface)*
- **Who are the actors?** Anonymous visitors, authenticated users, other tenants, staff, third-party callbacks. *(gate → boundaries)*

#### Batch B — stack and setup

Independent of Batch A and of each other. Every one becomes an ADR, and every one binds the implementer.

- Language, runtime, and package manager.
- Framework, and the rendering model if there is a UI.
- Hosting and deploy target. Can the whole thing run locally without credentials? If not, say what cannot, because every future test depends on it.
- Repo shape: single package or workspace, and where code lives.

**Two of these are already answered — read, do not ask.** The data store engine is a decision record written by `orc2 init`; the gate commands are `ORC2_GATE` in `.orc2/config.env`. Confirm them in one line each. If the grilling genuinely contradicts the engine record, supersede it explicitly rather than quietly assuming the new answer.

#### Batch C — operations

Independent of everything above. One batch.

- Environments, and how a change reaches production.
- What you look at when something is wrong: logs, metrics, error tracking, alerting.
- Backup, and the restore you have actually rehearsed.
- Rollback — specifically, rollback of a change that included a migration.

#### Batch D — the domain

- The core entities and the words for them. Use `/domain-modeling` to pin the vocabulary and kill synonyms now — a glossary settled here is what stops two PRDs building the same concept under two names. *(gate → the two questions below)*

Once the entities are named, both follow-ups go out together:

- The state machines. What transitions exist, which are irreversible, and who can trigger them.
- **If the domain carries money, stock, or quota:** the rounding rule, the currency, and who is allowed to change a total. Skip entirely if it carries none.

#### Batch E — interface *(only if Batch A said there is one)*

Both together; neither depends on the other.

- The design contract — a pixel-exact file, lo-fi mocks, or nothing? `orc2 init` recorded this too, so confirm rather than ask.
- Viewport widths that must work, and the accessibility target. The pipeline treats accessibility as outranking the visual reference, so state it explicitly.

#### Batch F — trust and data

The questions that only get harder to answer later. The actors came from Batch A, so these follow-ups batch together:

- For each actor, what must be **authorised**, not merely authenticated? Enumerate the objects one could reach by guessing an id.
- What data is sensitive, and what is the blast radius if it leaks? Credentials, personal data, payment details, other people's content. *(gate → retention)*
- Secrets: where they live, who can read them, what happens on rotation.

Then, once you know what is sensitive:

- Retention and deletion. What must be deleted on request, and what must be kept.
- Regulatory or contractual constraints that dictate implementation rather than policy.

**Batches A, B, and C can go out back to back without waiting on each other** — only D, E, and F sit behind gates. In practice that is three batches, then three, for an agenda that reads like forty questions.

## Step 2 — Decompose into PRD areas

Now split the app into areas, each of which becomes one PRD. The rules:

1. **An area is a vertical capability, not a layer.** "Checkout" is an area; "the database" is not. A PRD whose tickets cannot be demonstrated to a person is a layer wearing an area's name.
2. **Foundation comes first and is genuinely first.** It is the only area allowed to be infrastructural, because everything else is unbuildable without it.
3. **Order by dependency and write the order down.** It goes in `.orc2/config.env` as `ORC2_BUILD_ORDER`, and the orchestrator reads it when choosing what to run next.
4. **Cover to release, not to feature-complete.** An app that works on a laptop is not shipped. If there is no area covering deploy, observability, and rollback, the plan stops at the demo.
5. **Every area names its own security acceptance criteria** — see below.

A generic set that covers most applications, to adapt rather than adopt:

| # | Area | What it covers | Notes |
| - | ---- | -------------- | ----- |
| 1 | **Foundation** | Repo shape, toolchain, the gate, CI, app shell, design tokens, a deployable skeleton | First. Everything blocks on it |
| 2 | **Identity & access** | Registration, sign-in, sessions, roles, permission model | Early — most later areas need a user to act as |
| 3 | **Core domain** (often 2–4 areas) | The actual product capability, split by vertical | Where most of the work is |
| 4 | **Data & persistence** | Schema, migrations, seeding, backup and restore | Often folded into Foundation and the domain areas |
| 5 | **Interface & navigation** | Screens, routing, empty and error states, responsive behaviour | Only if there is a UI |
| 6 | **Integrations** | Third-party services, webhooks, callbacks | Each one is a trust boundary and a decision record |
| 7 | **Observability** | Structured logs, metrics, error tracking, alerts on the one path that must never break | Not optional. Without it, production failures are anecdotes |
| 8 | **Security hardening** | Threat model written down, authorisation tests per boundary, rate limits, secrets handling, dependency policy, retention and deletion | See below — this is *in addition to* per-area criteria |
| 9 | **Release & operations** | Environments, deploy, migration safety, rollback, runbook | Last, and it must exist |

Merge areas freely where the app is small; a five-PRD plan that ships beats a nine-PRD plan that stalls. But **do not delete areas 7, 8, and 9 to make the plan look shorter** — dropping them does not reduce the work, it moves it to the worst possible moment.

## Security is cross-cutting *and* has its own area. Both.

This is the part that is most often got wrong, so it is stated twice on purpose.

**Cross-cutting.** Every PRD carries its own security acceptance criteria, written when the PRD is written. For each area, answer: which boundary does this cross, what must be authorised rather than merely authenticated, what input is untrusted, and what does this area log that it should not. A PRD with no security criteria has not been reviewed for security — it has been assumed safe.

**Its own area.** The hardening PRD covers what no single feature owns: the written threat model, authorisation tests that try the wrong account against every reachable object, rate limits, secret handling and rotation, the dependency and advisory policy, retention and deletion. Nobody's feature ticket will do these, which is exactly why they need a PRD.

If a security question turns out to be a genuine design decision — how sessions are stored, what a permission means — route it to the `decider`, which records it at `Stakes: high` because it touches access control.

## Step 3 — One spec per area

For each area, run `/to-spec` (your install may name it `/to-prd`) and produce one PRD. Each PRD needs:

- **User stories** — what someone can do, that they could not do before.
- **Acceptance criteria per story** — observable, not aspirational. "Works properly" is a finding waiting to happen.
- **Security criteria** — per the section above.
- **Testing decisions** — what is proven by a test versus checked by hand, and the named edge cases. QA reads this as its checklist, so an empty section makes QA improvise.
- **Dependencies on other areas**, by name.
- **Non-goals**, carried down from the grilling.

Write them all before slicing any of them. A PRD written in isolation contradicts its neighbours, and the contradiction surfaces as a reviewer finding three lanes later.

## Step 4 — Slice, then hand over

Per PRD, run `/to-tickets`. Each ticket must carry what the pipeline reads:

- acceptance criteria — the reviewer's contract
- `## Depends on` — how the orchestrator picks what to run
- `## Relevant files` — the change surface, used to decide what may run in parallel
- `## Visual reference` on screen work, with a tagged source

Then record the area order as `ORC2_BUILD_ORDER` in `.orc2/config.env` and run `orc2 render`, so the orchestrator and the entry-point skills all state the same order.

Only now does `/run-prd <area>` mean anything. Run the first area, stop at its human checkpoint, and look at what came out before starting the second — the first PRD through a new pipeline is also a test of the plan.

## Do not

- **Do not ask these one at a time.** The agenda is long; walked serially it is an interrogation, and the human stops reading around question twelve. Batch everything not behind one of the five gates.
- **Do not ask what you can read.** The engine, the design contract, and the gate commands are already recorded. Confirming them costs one line; asking them costs trust.
- **Do not slice everything up front and start the pipeline on all of it.** The first area will teach you something about the plan. Build it, look, adjust.
- **Do not let an agent invent the tech stack.** Every stack answer is an ADR or a decision record, made by a person, in this session.
- **Do not skip the grilling because the app seems obvious.** The obvious apps are the ones where two people held two different models of it and nobody noticed until integration.
