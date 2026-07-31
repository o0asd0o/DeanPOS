# Domain docs

How the pipeline's roles should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root, if it exists — it points at one `CONTEXT.md` per bounded context. Read each one relevant to the topic.
- **`docs/adr/`** — system-wide architectural decisions.
- **`src/<context>/docs/adr/`** — context-scoped decisions. Read the ADRs that touch the area you are about to work in.
- **`.scratch/decisions/`** — decision records written by the `decider` during pipeline runs. These are not ADRs; they are the audit trail of choices made on the human's behalf, and a record on your area is as binding as an ADR until it is overturned.

If any of these do not exist, **proceed silently.** Do not flag their absence and do not suggest creating them upfront. The domain-modeling skill creates them lazily, when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← system-wide decisions
├── .scratch/decisions/                 ← pipeline decision records
└── src/
    ├── <context-a>/
    │   ├── CONTEXT.md                 ← glossary for this context
    │   └── docs/adr/                  ← context-specific decisions
    └── <context-b>/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept — an issue title, a refactor proposal, a hypothesis, a test name — use the term as defined in the relevant context's `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids; those are decided vocabulary, not style preferences.

If the concept you need is not in the glossary yet, that is a signal: either you are inventing language the project does not use (reconsider), or there is a real gap (note it).

## Flag conflicts, never override silently

If your output contradicts an existing ADR or decision record, surface it explicitly:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

In the pipeline, that is not a note you write and move past. A contradiction between an issue and a recorded decision is routed to the `decider`, and the role that found it stops on that finding rather than picking a side.
