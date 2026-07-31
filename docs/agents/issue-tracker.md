# Issue tracker: local markdown

Issues and PRDs for this repo live as markdown files in `.scratch/`. There is no remote issue tracker, so no `gh` or `glab` commands apply.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The PRD is `.scratch/<feature-slug>/PRD.md`
- Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is a `Status:` line near the top of each issue file (see `triage-labels.md` for the permitted values)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## Every issue carries its dependencies and its change surface

Two sections the pipeline reads directly, so they are not optional:

- **`## Depends on`** — the issues that must close first. The orchestrator builds its selectable set from these.
- **`## Relevant files`** — the files this slice expects to touch. Two issues that share an entry here must not run in parallel; that is a merge conflict scheduled on purpose.

## Visual reference on screen-fidelity issues

When an issue renders something with a designed appearance, give it a `## Visual reference` section so the implementer has the contract up front rather than guessing.

A reference is one or more **tagged entries**. Tag every entry with its source, scope, and viewport:

- **source** — a design-file node link, **or** a path to an image committed under `.scratch/<prd>/reference/`
- **scope** — `whole-screen`, or `component: <name>`
- **viewport** — a pixel width, or `web` / `mobile`

```
## Visual reference

- Figma · whole-screen · 1440: [node 1:2639](https://www.figma.com/design/.../?node-id=1-2639&m=dev)
- Figma · whole-screen · 375: [node 1:14477](https://www.figma.com/design/.../?node-id=1-14477&m=dev)
- Image · component: TrustBadges · 375: `docs/reference/ordering/trust-badges-375.png`
```

Rules:

- **Only screen-fidelity issues.** Backend, data-model, and schema issues have no visual — do not add this section to them. A stray reference is noise a weak model will chase.
- **A node link is a tight contract; a plain image is a looser one.** The `source` tag tells the implementer which it is, so never drop it.
- **Verify a node id before pinning it.** A wrong id is trusted blindly and produces a confident wrong build. If unsure, name the frame in prose instead of pinning a guess.
- **Commit image files into the repo** so a lane worktree can read them and they cannot go missing.
- **The entry is a pointer.** The orchestrator captures node-sourced frames to `.scratch/<prd>/reference/` at run time; an image entry is already that file.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/`, creating the directory if needed.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The path or the issue number is normally passed directly.

## Pull requests

Not a request surface. This repo has no remote, so triage operates only on the files under `.scratch/`.
