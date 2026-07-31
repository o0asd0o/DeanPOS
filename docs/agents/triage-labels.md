# Triage labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual strings this repo's tracker uses.

Because this repo uses a local-markdown tracker, these are not tracker labels — they are the permitted values of the `Status:` line near the top of each issue file under `.scratch/`.

| Canonical role    | Value here        | Meaning                                                       |
| ----------------- | ----------------- | ------------------------------------------------------------- |
| `needs-triage`    | `needs-triage`    | Someone needs to evaluate this issue                          |
| `needs-info`      | `needs-info`      | Waiting on more information before it can proceed             |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an unattended agent                |
| `ready-for-human` | `ready-for-human` | Not yet built; needs a human to implement it                  |
| —                 | `done`            | Built, reviewed, merged to `main` with a green gate |
| `wontfix`         | `wontfix`         | Will not be actioned                                          |

When a skill mentions a role, write the corresponding value into the issue file's `Status:` line.

## `done` is not a canonical role, and `ready-for-human` does not mean finished

`done` has no canonical counterpart because the five roles describe work that is still _open_. It exists here because this tracker has no closed state — an issue file stays on disk after it merges, so without `done` there is no way to distinguish finished work from work waiting on a person.

Writing `ready-for-human` on a successful close collides with its real meaning and leaves every issue reading the same whether it was complete or blocked. **Set `done` on close. Reserve `ready-for-human` for work an agent must not attempt.**

A `done` issue may still carry open questions for a person — an unverified figure, a flagged design conflict. Those live under `## Comments` and surface at the PRD checkpoint. They do not change the `Status:` line, because the _work_ is finished; what remains is a decision, not an implementation.
