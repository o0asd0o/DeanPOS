# 016: The raw-design-value guard parses with TypeScript's own compiler, obtained from the package Microsoft published for exactly this situation

- **Status:** decided
- **Stakes:** high
- **Date:** 2026-08-02
- **Asked by:** human (routed from `.scratch/foundation/issues/12-styling-standard-and-raw-value-guard.md`, status `needs-info`)

## The question

`assertNoRawDesignValues(dir)` in `packages/ui/src/test-seam.ts` is the gate that
enforces code-standard rule 6 over roughly thirty screens that unattended agents will
write across eleven product areas. It has been rebuilt five times as a scanner over raw
source text, and each rebuild closed one class of defect and opened another. The human
has ruled that it becomes a real parser. **This record decides which parser, which
workspace declares it, whether it is catalog-pinned, and how the walk is written.**

A wrong answer costs in two directions and they are not symmetric. A parser that is hard
to install or hard to keep working is an annoyance. A parser that produces a **false
positive on valid code** is a gate that fails an agent for writing correct code, and the
cheapest move available to that agent is to delete the test — after which raw hex values
reach real screens and nothing in the repository notices.

**Not open, and not reopened:** whether a parser is adopted at all (the human decided
that), what rule 6 says, the `// design-exempt:` syntax, the explicitly-named
`apps/pos/src` / `apps/backoffice/src` scope, and the exclusion of
`packages/ui/src/components/`. Those are settled in the issue, in
`docs/agents/code-standards.md` rule 6, and in record 007.

### Weights used for the ranking

Declared before any option was scored, and **not changed afterwards**.

| Criterion | Weight | Why |
| --- | --- | --- |
| User impact | ×1 | Nobody sees a test file, and every parser option fixes the same false positives identically — this criterion is real but it does not separate the options. Same reasoning as record 015. |
| Business impact | ×1 | Every candidate is free. Licences are checked below and all are permissive. Little separates them commercially. |
| Engineering cost and risk | ×2 | How much guard code the choice deletes versus adds, whether it parses TSX with no configuration, whether it runs under Bun with no build step, and whether it drags in a platform matrix. |
| Reversibility | ×2 | Eleven areas are graded by this gate. This is the headline risk — and the finding below is that it does not separate the options either, which is worth knowing rather than assuming. |
| Evidence strength | ×2 | The load-bearing fact here is what the `typescript` package on disk actually is, and a confidently-wrong answer about it is the specific failure this record exists to prevent. |

Maximum possible total: 40. Same shape as records 006, 008 and 015, for the same reason.

## What I chose, and why

**`packages/ui` declares one new devDependency, `@typescript/typescript6` at `6.0.2`,
and the guard is rewritten against TypeScript's own compiler API.** No catalog pin. No
alias syntax. No other manifest in the repository changes.

### The fact that decides this, and it is first-party

The question was framed as "the repo's own TypeScript cannot do it, so this is genuinely
a new dependency". That is correct, and the reason is bigger than this repository.
TypeScript 7.0 shipped on 8 July 2026 as the native Go port, and Microsoft's own
announcement says it plainly:

> TypeScript 7.0 is made without an API.

> We expect TypeScript 7.1 to ship with a new (and different) API, but until then we
> have made it a priority to ensure TypeScript can be run side-by-side with TypeScript
> 6.0.

So the verification done in the issue — importing `typescript@7.0.2` and finding no
`createSourceFile` — is not a quirk of this install. It is the shipped design, and
Microsoft anticipated the exact problem this record is solving. Two days before 7.0,
on 6 July 2026, they published the answer:

> We've published a new compatibility package, `@typescript/typescript6`. This package
> provides an executable named `tsc6`, so that if needed, you can install TypeScript
> 7.0 (which ships its own `tsc` binary) side-by-side without naming conflicts.

**This is not a workaround I invented. It is the supported path, published by the
compiler team, one month old, for precisely the situation DeanPOS is in.**

### Why that removes the trap the question worried about

The question named the real risk: "two TypeScript packages in one repo is a trap worth
pricing honestly." It is a trap, and it is worth pricing — so here is the price, and it
is zero, for a structural reason rather than an optimistic one.

All nine workspaces declare `"typescript": "^7.0.2"`. That key is what `vp check`
resolves, what an editor resolves, and what the `tsc` binary comes from. **Nothing about
that changes.** `@typescript/typescript6` is a *different package name*, so:

- The `typescript` specifier still resolves to 7.0.2 everywhere. There is no second
  package competing for the name, in any workspace, at any depth.
- Its binary is `tsc6`, not `tsc`. Microsoft renamed it for this exact reason and said
  so. Nothing shadows the native compiler in `node_modules/.bin`.
- The JavaScript compiler it re-exports is pulled in **transitively**, under the alias
  `@typescript/old`, so its own `tsc` binary is never linked at all — package managers
  link the binaries of direct dependencies, not of dependencies-of-dependencies. This is
  the whole point of the shim's shape.

I read the published package rather than trusting the announcement. It is nine files and
10 KB, and the two that matter are one line each:

```js
// lib/typescript.js
module.exports = require("@typescript/old");
```

```ts
// lib/typescript.d.ts
import ts = require("@typescript/old");
export = ts;
```

with `"dependencies": { "@typescript/old": "npm:typescript@^6" }` and
`"bin": { "tsc6": "./bin/tsc6" }`. It is a rename, and nothing more.

The `export = ts` form is why the import in the guard is written as a **default import**:
`packages/tsconfig/base.json` sets `"esModuleInterop": true`, which is what makes
`import ts from "@typescript/typescript6"` both typecheck and work at runtime under
Bun. It also sets `"skipLibCheck": true`, which keeps TypeScript's very large `.d.ts`
from being checked line by line on every `vp check`.

### Why TypeScript's parser and not a smaller one

The runner-up is `@babel/parser`, and it is a genuinely good option — I want to be
honest about that before explaining why it lost, because the human reversing this
decision will most likely be moving to it. It is 2.0 MB against TypeScript's ~23 MB, it
is MIT, and it is **almost certainly already in the lockfile**, because `packages/ui`
already declares `@vitejs/plugin-react@6.0.5` (record 015) and that pulls `@babel/core`.
On raw install cost it wins outright.

It loses on the two things this particular guard is made of.

**One: TypeScript's parser is the definition of the language the guard reads; Babel's is
a re-implementation of it.** Every other candidate — Babel, oxc, acorn's TypeScript
plugin — is tracking a specification owned by someone else. For most tools that gap
never matters. For a guard whose false positives get it deleted, "the parser that
defines the syntax" is worth twenty megabytes of development-only disk. There is no
version of this guard in which Babel's TSX support is *more* correct than TypeScript's.

**Two: TypeScript ships the parser, the tree-walker, and the predicates in one package.**
`ts.forEachChild` is the walk. `ts.isJsxAttribute`, `ts.isJsxSpreadAttribute`,
`ts.isCallExpression`, `ts.isConditionalExpression`, `ts.isStringLiteral` are the
predicates the classification below is written in. `@babel/parser` ships a parser and
nothing else: the walk is either a second package (`@babel/traverse`, which brings
`@babel/generator`, `@babel/template` and several helpers) or about a dozen lines of
hand-rolled recursion the guard then owns. **The entire point of adopting a parser is to
stop owning tree-walking code that has been rebuilt five times.** Adding some back on
day one is the wrong direction.

There is a third, smaller thing. `@babel/parser` needs a plugin list, and the right list
differs between `.ts` and `.tsx` — `jsx` may not be enabled for `.ts`, because it changes
how `<` parses. So the guard branches on the file extension and carries a plugin matrix
that has to be maintained as the language grows. TypeScript's `createSourceFile` takes a
`ScriptKind` and needs no configuration beyond it.

### What this deletes

This is the part that makes the dependency pay for itself. Of the 403 lines in
`packages/ui/src/test-seam.ts` today, roughly 250 are a hand-written lexer:
`skipString`, `skipNonCode`, `matchBalanced`, `splitTopLevelArgs`, `isStringLiteral`,
`stringContent`, `stripComments`, `lastTopLevelAnd`, `splitTernary`,
`findAttributeSites`, the `CVA_BINDING` regex and `collectCvaNames`. **All of it goes.**

What stays is the part that was never the problem, because it operates on a class string
rather than on source code: `HEX_LITERAL`, `ARBITRARY_VALUE`, `hasArbitraryProperty`,
`hasRawValue`, `EXEMPT_COMMENT`, `isExempt`, `collectFiles`, and the reporting shell that
collects offenders into two named lists.

The five known defects close as a consequence of the parse, not as five more fixes:

| Defect | Why it disappears |
| --- | --- |
| `// className=example` in a comment throws | A comment produces no `JsxAttribute` node. |
| `` const docs = `className={value`; `` throws | A template literal produces no `JsxAttribute` node. |
| `<div {...{ className: "bg-[#fff]" }} />` missed | `ts.isJsxSpreadAttribute` over an `ObjectLiteralExpression` is walked explicitly. |
| `// const getClasses = cva("p-4")` spoofs a binding | A comment declares nothing. Bindings come from `VariableDeclaration` nodes. |
| local `function getVariants()` passes on the suffix | Name resolution, below. |

### The one behavioural change: `*Variants` stops being a free pass

The last defect is the only one that needs a rule rather than just an AST, so it is
stated here rather than left to the implementer.

Rule 6 deliberately allows a call to a name ending in `Variants`, and gives its reason:
"that second form is what lets a component call another file's exported variants
function." That need is real and it stays. What must stop is a name in the *same* file
getting in on the suffix alone. With an AST the two are distinguishable, so:

> A call `name(...)` in a `className` value is allowed if **either** `name` is bound in
> this file by a `const name = cva(...)` initialiser, **or** `name` is *imported* into
> this file, ends in `Variants`, and is not also declared locally by anything else.
> Every other call is banned.

A local `function getVariants()` is now caught, because it is a local declaration that is
not a `cva(...)` initialiser. An imported `badgeVariants` still works, because we cannot
see across files and the suffix plus the import is the contract — and the file it comes
from is either `packages/ui/src/components/`, which is generated and reviewed by hand,
or another application file that this same guard is already scanning.

### Where it is declared, and why there is no catalog pin

**`packages/ui`, as a `devDependency`, and nowhere else.** The guard lives at
`packages/ui/src/test-seam.ts`; the parser is imported by that file and no other. Record
015 established that `packages/ui` may declare its own test tooling and that this is not
a second seam, and the reasoning transfers directly: the workspace that owns the code
owns the tooling that tests it.

Two things make the `devDependency` placement safe rather than merely conventional, and
both are already true today:

- `test-seam.ts` is reachable only through the `"./test-seam"` export subpath, never
  through `"."`. `packages/ui`'s runtime surface is `src/index.ts`, and nothing in that
  import graph touches this file.
- `test-seam.ts` **already imports `node:fs` and `node:path`**. It is already, and
  unambiguously, a Node-only test-time module. A parser import changes nothing about its
  character.

Record 007's import ban is unaffected: `@typescript/typescript6` is not `contract`,
`schemas`, `backend`, `@orpc/*` or `@tanstack/*`, and it carries no domain knowledge. A
reviewer should not flag it.

**No catalog pin.** This is record 004's `pg` situation and it gets `pg`'s answer, the
same one records 007 and 008 gave to every single-declarer package. `packages/ui` is the
only workspace that will ever declare it, because the guard is the only consumer and the
guard lives here. A catalog entry with one consumer is indirection with no payoff.
**Trigger to revisit:** a second workspace declaring it — and treat that need as evidence
that a second guard was built outside `packages/ui`, and check *that* before adding the
pin.

### Licence and provenance

Apache-2.0, published by Microsoft, maintainers including the TypeScript team's own
publishing accounts. Permissive, not copyleft, and safe for commercial software — the
same standing as the rest of the front-end tree, where the only non-permissive licence
is `axe-core`'s MPL-2.0 (record 007).

## The options, ranked

| Rank | Option | User ×1 | Business ×1 | Eng cost/risk ×2 | Reversibility ×2 | Evidence ×2 | Total |
| ---- | ------ | ------- | ----------- | ---------------- | ---------------- | ----------- | ----- |
| 1 | **`@typescript/typescript6@6.0.2` — TypeScript's own compiler API** | 4 | 4 | 4 (8) | 5 (10) | 5 (10) | **36** |
| 2 | `@babel/parser@7.29.8`, with a hand-rolled walk | 4 | 4 | 3 (6) | 5 (10) | 4 (8) | **32** |
| 3 | Reuse the parser already inside vite-plus (`rolldown/parseAst`) | 4 | 4 | 2 (4) | 5 (10) | 2 (4) | **26** |
| 4 | `oxc-parser@0.142.0` | 4 | 3 | 2 (4) | 5 (10) | 2 (4) | **25** |
| 5 | `acorn` + `acorn-jsx` + `acorn-typescript` | 4 | 3 | 2 (4) | 5 (10) | 2 (4) | **25** |
| 6 | Do nothing — keep the text scanner, document the defects | 1 | 2 | 2 (4) | 5 (10) | 1 (2) | **19** |

**Reversibility does not separate these options, and that is a finding rather than a
shrug.** Every candidate is imported by exactly one file, and that file's only export is
`assertNoRawDesignValues(dir: string): void` — a signature in which no parser type
appears. There is no adapter to write because the file already *is* the adapter. So all
six score 5, and the ranking rests entirely on engineering cost and evidence, which are
the two criteria weighted ×2 that actually move. That is worth saying out loud, because
"choose the more reversible one" is the tiebreak this process usually leans on and here
it has nothing to say.

**1. `@typescript/typescript6@6.0.2` — chosen.** One package, no configuration, parser
and walker and predicates included, and the reference implementation of the syntax being
read. Its engineering score is 4 rather than 5 for three honest reasons: it is ~23 MB of
development-only disk to parse thirty files; the loud-failure-on-unparsable-input
property is kept using `parseDiagnostics`, which is an internal property rather than a
documented API; and I have not run it in this repository. Its evidence score is a 5 and
it is earned — the announcement, the compatibility package, its published contents and
its registry metadata were each read from the source that owns them, and they agree.

**2. `@babel/parser@7.29.8`, with a hand-rolled walk.** The strongest losing option and
the one to move to. MIT, 2.0 MB unpacked, one dependency (`@babel/types@^7.29.8`), and
very likely already in the lockfile via `@vitejs/plugin-react`'s `@babel/core` — on
install cost it beats the winner outright. It loses on the two facts in the section
above: no walker in the package, so the guard hand-rolls recursion again or takes
`@babel/traverse`'s much larger tree; and a plugin list that must differ between `.ts`
and `.tsx`. Its evidence score of 4 rather than 5 reflects that Babel's TypeScript
support is a re-implementation that tracks the specification rather than defining it —
which is a small risk, honestly, and it is loud when it fires, because a parse failure
throws rather than passing silently.

**3. Reuse the parser already inside vite-plus.** This is rung 5 of the ladder and it had
to be taken seriously, because a dependency you do not add is the cheapest dependency
there is. Rolldown really does document `parseAst` and `parseAstAsync` exported from
`rolldown/parseAst`, and rolldown is oxc underneath, so the capability is genuinely
sitting in this repository already. It loses on reachability rather than on capability:
this repository declares `vite` aliased to `@voidzero-dev/vite-plus-core@0.2.5`, which
*bundles* rolldown — it does not declare `rolldown`, so `rolldown/parseAst` is an
undeclared transitive path that a patch bump of vite-plus may move or remove with no
warning and no error until the guard stops working. Records 005, 008, 011 and 015 each
independently found that vite-plus publishes no documentation, and this record found the
same. Declaring `rolldown` outright to make the path legitimate would be a far larger
dependency than option 4 for the identical parser. Evidence 2: the API is documented by
rolldown, its reachability and its TSX behaviour *in this install* are not.

**4. `oxc-parser@0.142.0`.** MIT, fast, and first-party to the oxc project. Speed is not
a criterion here — the guard reads about thirty files — so it is competing on the things
that cost. It is a `0.x` release line with an active weekly cadence, meaning the AST
shape is a moving target; it ships eight platform-specific NAPI binaries as
`optionalDependencies`, so the lockfile grows a platform matrix that a future Linux CI
has to resolve correctly on a machine nobody has tried yet; and it provides no walker, so
the guard hand-rolls recursion as in option 2. No first-party source states that
`oxc-parser` is exercised under Bun. Business 3 rather than 4 because eight native
binaries are a supply-chain surface a commercial product carries permanently.

**5. `acorn` + `acorn-jsx` + `acorn-typescript`.** Three packages to do what one does, and
the maintenance signal is the reason it ranks last of the parser options rather than
level with oxc on the tie: `acorn-jsx@5.3.2` was last published on 9 July 2021, and
`acorn-typescript@1.4.13` is a third-party community port of TypeScript's grammar rather
than a first-party implementation of it. **`meriyah` is excluded on a fact rather than a
reputation:** it parses ECMAScript and JSX and has no TypeScript support at all, so it
cannot parse a single `.tsx` file in these two applications, every one of which carries
type annotations.

**6. Do nothing — keep the text scanner.** Included because it must be, and 10 of its 19
points come from reversibility, which any do-nothing option maximises trivially — the
same inflation records 002, 007, 008 and 015 each left visible rather than tuned away. It
is refuted by its own history: five rebuilds, each closing one class of defect and
opening another, and the current state still throws on `// className=example` in a
comment. The user score of 1 is the whole argument. A guard that fails an agent for
writing a correct comment is a guard that gets deleted by the first agent that hits it,
and after that the thirty screens are ungraded and nothing says so.

## What the implementer does

### 1. `packages/ui/package.json` — one line added

```json
"devDependencies": {
  "@typescript/typescript6": "6.0.2"
}
```

Inserted in alphabetical position, between `"@types/react-dom": "catalog:"` and
`"@vitejs/plugin-react": "catalog:"`. Exact version, inline, no `catalog:` — the
single-declarer shape record 004 established and records 007 and 008 followed.

**Nothing else in any manifest changes.** The root `catalog` block is untouched.
`"typescript": "^7.0.2"` stays exactly as it is in all nine workspaces, `packages/ui`
included.

Then `vp install`, and **check three things in the `bun.lock` diff before committing**,
because each presents as a passing test rather than as an install error:

- `@typescript/typescript6@6.0.2` resolved once.
- Exactly one `typescript@6.x` resolved under the `@typescript/old` alias. This is the
  payload; the shim pins only itself, and its dependency range is `^6`, so the *lockfile*
  is what fixes the compiler version. Record that version in the commit message.
- `typescript@7.0.2` still resolved for the plain `typescript` key. If a `typescript@6.x`
  ever appears under the plain key, the trap this record avoids has been sprung.

### 2. `packages/ui/src/test-seam.ts` — the rewrite

The import, given `esModuleInterop: true` in `packages/tsconfig/base.json` and the
shim's `export = ts`:

```ts
import { readFileSync } from "node:fs";
import ts from "@typescript/typescript6";
```

**Parse.** `ScriptKind` is passed explicitly rather than left to be inferred from the
filename — one line, and it removes an assumption nobody would think to re-check:

```ts
const kind = filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, false, kind);
```

`setParentNodes` is `false` because nothing here walks upward — which means every
`getStart` call must be passed `sf` explicitly.

**Keep the loud failure on unparsable input.** `createSourceFile` recovers from syntax
errors rather than throwing, so a broken file would otherwise yield a partial tree and a
silent false negative:

```ts
const parseErrors =
  (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
if (parseErrors.length > 0) {
  throw new Error(`${filePath}: cannot parse — ${parseErrors.length} syntax error(s)`);
}
```

`parseDiagnostics` is internal rather than declared, hence the cast. It has been present
and stable for a decade, and pinning a version line that Microsoft has declared final
means it cannot drift underneath us. **If it does not compile, delete the check** — the
gate runs `check` before `test`, so a file that does not parse never reaches this code —
and say so in the build report rather than inventing a substitute.

**Collect bindings, one walk over the whole file.** Three sets:

- `cva` — from any `VariableDeclaration` whose name is an `Identifier` and whose
  `initializer` is a `CallExpression` with callee `Identifier` named `cva`.
- `imported` — from every `ImportDeclaration`: `importClause.name` for a default import,
  and each `ImportSpecifier.name.text` under `NamedImports`.
- `otherLocal` — every other value declaration of a name anywhere in the file:
  `VariableDeclaration`s that are not `cva(...)` initialisers, `FunctionDeclaration`s,
  `ClassDeclaration`s.

```ts
function isVariantsCall(call: ts.CallExpression): boolean {
  if (!ts.isIdentifier(call.expression)) return false;
  const name = call.expression.text;
  if (cva.has(name)) return true;
  return name.endsWith("Variants") && imported.has(name) && !otherLocal.has(name);
}
```

**Find the sites.** One recursive visitor over `ts.forEachChild`, handling two node
kinds:

```ts
const visit = (node: ts.Node): void => {
  if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
    handle(node.name.text, node.initializer, node);
  } else if (ts.isJsxSpreadAttribute(node) && ts.isObjectLiteralExpression(node.expression)) {
    for (const prop of node.expression.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      if (!ts.isIdentifier(prop.name) && !ts.isStringLiteral(prop.name)) continue;
      handle(prop.name.text, prop.initializer, prop);
    }
  }
  ts.forEachChild(node, visit);
};
ts.forEachChild(sf, visit);
```

A non-literal spread (`{...props}`) and a computed key are not sites — the guard cannot
see inside them, which is the same limitation it has today and is a false *negative*,
never a false positive.

**`handle(name, value, node)`**, in order:

1. Return unless `name` is `className` or `style`.
2. `const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;`
3. Return if `isExempt(lines[line - 2])` — the escape hatch stays textual, because "the
   line immediately above" is a textual rule by definition, and it is now reliable
   because the site itself is no longer found by scanning text.
4. If `name === "style"`, record a raw-value offender at `${filePath}:${line}` and
   return. Every shape of `style=` is banned; there is nothing to inspect.
5. Unwrap the value: for a `JsxAttribute` the initializer is `undefined`, a
   `StringLiteral`, or a `JsxExpression` whose `.expression` may itself be `undefined`
   (`className={}`). For a `PropertyAssignment` it is the initializer directly. A missing
   expression is `assembled`.

**Classify.** Two mutually recursive functions, mirroring rule 6 exactly. Both push every
class string they find onto a `classes` array, which is scanned afterwards with the
existing `hasRawValue`.

`classifyValue` — the whole `className` value. Allowed: a `StringLiteral`, or a
`CallExpression` whose callee is the `Identifier` `cn` and **every** argument classifies
as allowed. `ParenthesizedExpression` unwraps. Anything else is `assembled`.

`classifyArg` — one argument to `cn(...)`. Allowed: a `StringLiteral`; the `Identifier`
`className`; a `ConditionalExpression` whose `whenTrue` and `whenFalse` both classify as
allowed; a `BinaryExpression` whose `operatorToken.kind` is
`ts.SyntaxKind.AmpersandAmpersandToken`, classified on its `right` only; or a
`CallExpression` satisfying `isVariantsCall`. `ParenthesizedExpression` unwraps. Anything
else is `assembled`.

Two details that are easy to get wrong:

- **Do not short-circuit the argument loop.** `arguments.every(...)` stops at the first
  failure and would skip scanning later arguments' class strings. Loop over all
  arguments, classify each, and set the verdict to `assembled` if any failed.
- **`ts.isStringLiteral` is deliberately false for a template literal.** A backtick string
  is a `NoSubstitutionTemplateLiteral` or a `TemplateExpression`, neither of which
  matches, so both fall through to `assembled` — which is what rule 6 requires.

**Skip generated output.** Add one clause to the file filter:

```ts
.filter((path) => /\.tsx?$/.test(path) && !path.includes("/generated/"))
```

Record 008 puts each application's generated route tree at
`apps/<app>/src/generated/routeTree.gen.ts`, inside the scanned directory. It is a large
machine-written file that nobody may edit, so parsing it costs time on every run and a
hit inside it would be unfixable. One line closes both.

### 3. `packages/ui/tests/test-seam.test.ts` — the proof

The issue requires the guard be proved to bite, and that proof now has to cover the five
defects this record closes. Add a case for each, and each one must be *observed* failing
or passing rather than asserted from the code:

- `// className=example` in a comment — **passes** (was a false positive).
- `` const docs = `className={value`; `` — **passes** (was a false positive).
- `<div {...{ className: "bg-[#fff]" }} />` — **fails** (was a false negative).
- `// const getClasses = cva("p-4")` above `cn(getClasses())` — **fails** (was a false
  negative).
- a local `function getVariants() { return "bg-[#fff]" }` called in `cn(...)` — **fails**
  (was a false negative).
- an *imported* `badgeVariants` called in `cn(...)` — **passes**, which is the case the
  tightened rule must not break.

Plus the boundary cases rule 6 already names, which must keep behaving: `bg-[#fff]`,
`p-[13px]`, `shadow-[...]`, `grid-cols-[repeat(3,minmax(0,1fr))]`, `w-[calc(...)]` and
`[color:red]` all fail; `[&_svg]:size-4`, `[data-state=open]:`,
`supports-[display:grid]:grid`, `[&:hover]:underline` and
`[&_svg:not([class*='size-'])]:size-4` all pass.

### No-gos

- **No `typescript@6.x` under the plain `typescript` key**, in any workspace, ever. That
  is the trap; `@typescript/typescript6` exists so it is not necessary.
- **No `npm:` alias for this.** The repository uses alias syntax once, for `vite`, and it
  is not needed here — a direct alias of `typescript@6` would link its `tsc` binary and
  collide with the native one, which is the exact conflict Microsoft renamed the binary
  to avoid.
- **No `@babel/*`, `oxc-parser`, `acorn*` or `meriyah` in any manifest** as long as this
  record stands. One parser.
- **No import of `rolldown`, `oxc`, or any vite-plus internal from `packages/ui`.**
- **No second parser call site.** `packages/ui/src/test-seam.ts` imports it; nothing else
  does. This is what keeps reversibility at 5 and it is checkable:
  `rg -l '@typescript/typescript6' packages apps` must return exactly one path.
- **No `@typescript/typescript6` in `dependencies`.** It is development-only, and nothing
  under `packages/ui/src/` that is reachable from `src/index.ts` may import it.
- **No widening of what `className` accepts** to make an existing file pass. If real
  application code needs a shape rule 6 bans, that is a question for the human, not a
  loosened classifier.

## How to turn it back

Two separable reversals, costed separately because one number would be dishonest.

**Layer 1 — swap the parser, keep the AST design. One commit, one file.**

1. Write a superseding record; flip this record's `Status:` to `overturned` with the date
   and reason; update both lines in `LOG.md`.
2. Replace the import and the roughly six `ts.*` predicate calls in
   `packages/ui/src/test-seam.ts` with the replacement's equivalents. For
   `@babel/parser` that is `parse(source, { sourceType: "module", plugins: [...] })`, a
   hand-rolled walk of about a dozen lines, and the node names `JSXAttribute`,
   `JSXSpreadAttribute`, `ObjectProperty`, `StringLiteral`, `CallExpression`,
   `ConditionalExpression`, `LogicalExpression`.
3. Swap the one manifest line in `packages/ui/package.json`. `vp install`, commit
   `bun.lock`.
4. `vp check; vp run -r check; vp run -r test`.

**This does not get more expensive with time, and the reason is structural rather than
optimistic.** The parser is imported by one file; that file's only export takes a string
and returns `void`; no parser type appears in any signature, in any test, or in either
application. `rg -l '@typescript/typescript6' packages apps` is the exact reversal cost
and it must always print exactly one path — which is also the no-go above, so the number
is enforced rather than hoped for. **Reversibility 5, and it is honestly 5.**

**What voids that estimate:** a `ts.` type escaping into the exported signature, or a
second file importing the parser. Both are the same grep.

**Layer 2 — the whole decision, back to a text scanner.** `git revert` of the
implementing commit, which restores the 403-line file. Available permanently for the same
reason as Layer 1: nothing is built on top of this. It is not recommended, and the reason
is in the ranking rather than in this section.

**What has been built on top of this record by the time either runs:** test files and one
manifest line. No product source file, no token, no schema, no migration, no contract, no
route and no handler knows this decision exists. The applications' two
`design-values.test.ts` files call `assertNoRawDesignValues("src")` and are unaffected by
any of it — they do not change in this issue and they do not change in either reversal.

## What would make this decision wrong

- **TypeScript 7.1 ships its new API.** This is the named re-check trigger, and it is the
  most likely one — Microsoft says 7.1 is expected to bring "a new (and different) API".
  When it lands, the right move is probably to drop `@typescript/typescript6` and use the
  compiler the repository already has. It is a Layer 1 reversal against a parser that is
  already installed, so it is cheaper than the original change. **Nothing about this is
  urgent when it happens**; the trigger is a re-scoring, not an emergency.
- **`import ts from "@typescript/typescript6"` does not resolve or does not typecheck
  under `module: nodenext` with `verbatimModuleSyntax: true`.** The reasoning above says
  it should — the package has no `exports` map, `esModuleInterop` is on, and the `.d.ts`
  is `export = ts` — but I have not run it. Symptom: a resolution error or a "can only be
  default-imported" diagnostic on the first `vp check`. Fallback in order:
  `import * as ts from "@typescript/typescript6"`, then
  `const ts = require("@typescript/typescript6")` via `createRequire`. **Neither changes
  this record**; both are one line in one file.
- **Bun resolves the `npm:typescript@^6` alias inside a transitive dependency
  incorrectly.** Symptom: `@typescript/old` missing at runtime, or two TypeScript copies
  in the lockfile. This is the reason the three lockfile checks above are written down
  rather than left to judgement.
- **`parseDiagnostics` is not present on the parsed source file.** Symptom: the
  loud-failure check never fires. Pre-decided answer: delete the check, note it in the
  build report, and rely on `check` running before `test` in the gate.
- **A `.tsx` file in either application legitimately needs a `className` shape rule 6
  bans.** Once is the `// design-exempt:` hatch working as designed. A second and third
  time means rule 6 is wrong about real code, and that is the human's question, not a
  reason to widen the classifier.
- **The guard's runtime becomes noticeable.** Parsing ~30 files with the TypeScript
  parser should be well under a second, but I have not measured it and the file count
  grows with every area. If the two `design-values.test.ts` runs ever dominate the suite,
  option 2 is the pre-decided successor and the reason is install-and-parse weight, not
  correctness.
- **`@typescript/typescript6` stops being published or maintained.** It is a
  Microsoft-published 10 KB shim over a compiler line Microsoft has declared final, so it
  cannot rot in the usual way — but it also cannot receive fixes. That is acceptable for
  a parser of syntax that is frozen alongside it, and unacceptable the day the guard needs
  to understand a syntax TypeScript 7 introduced and 6 never knew. **That day is the same
  trigger as the first bullet**, which is why there is only one.

## Evidence

**Repository, read 2026-08-02, in the worktree `.worktrees/f12-styling-standard`:**

- `packages/ui/src/test-seam.ts` — all 403 lines, read in full. The 250 lines of
  hand-written lexer this record deletes (`skipString`, `skipNonCode`, `matchBalanced`,
  `splitTopLevelArgs`, `isStringLiteral`, `stringContent`, `stripComments`,
  `lastTopLevelAnd`, `splitTernary`, `findAttributeSites`, `CVA_BINDING`,
  `collectCvaNames`, `isSanctionedCall`), and the parts that survive because they read a
  class string rather than source code (`HEX_LITERAL`, `ARBITRARY_VALUE`,
  `hasArbitraryProperty`, `hasRawValue`, `EXEMPT_COMMENT`, `isExempt`, `collectFiles`).
  Also the existing `import { readdirSync, readFileSync, statSync } from "node:fs"`,
  which is the fact that makes this file already Node-only and already test-only.
- `packages/ui/package.json` — the fourteen devDependencies this record adds a fifteenth
  line to; `"typescript": "^7.0.2"`; the `exports` map showing `"./test-seam"` as a
  subpath distinct from `"."`, which is what keeps the parser out of the runtime graph.
- `packages/tsconfig/base.json` — **`"esModuleInterop": true`** (the fact that decides
  the import form), `"skipLibCheck": true` (which keeps TypeScript's large `.d.ts` cheap),
  `"module": "nodenext"`, `"moduleResolution": "nodenext"`, `"verbatimModuleSyntax": true`,
  `"strict": true`, `"types": ["node"]`. `packages/ui/tsconfig.json` — `"jsx":
  "react-jsx"` and `include: ["src/**/*", "tests/**/*"]`, both already correct, so no
  tsconfig change is needed.
- Root `package.json` — all nine workspaces' `typescript` declarations are `^7.0.2`; the
  `catalog` block, which this record does not touch; and the single existing use of
  `npm:` alias syntax, `"vite": "npm:@voidzero-dev/vite-plus-core@0.2.5"`, which
  establishes that aliasing is precedented here but is not needed for this.
- `apps/pos/tests/design-values.test.ts` and `apps/backoffice/tests/design-values.test.ts`
  — seven lines each, both calling `assertNoRawDesignValues("src")` through
  `ui/test-seam`. This is what makes the scope "named explicitly, never globbed", and it
  is why neither file changes in this issue or in either reversal.
- `docs/agents/code-standards.md` rule 6 — read in full, including the banned/allowed
  `className` grammar this record's classifier implements clause by clause, and the
  sentence that justifies keeping the `*Variants` suffix form: "that second form is what
  lets a component call another file's exported variants function."
- `.scratch/foundation/issues/12-styling-standard-and-raw-value-guard.md` — the fourteen
  acceptance criteria, and the four-way open question that was escalated to the human. The
  human's ruling (adopt a parser; narrow to `className` attribute contents) is the premise
  of this record and is not re-litigated.
- `.scratch/decisions/015-where-a-shared-component-render-test-lives.md` — the "who may
  declare" reasoning that puts this devDependency in `packages/ui`, and the two-declarer
  catalog threshold that this single-declarer package does not meet.
  `.../007-shared-ui-dependency-set.md` — the greppable import ban (which this package
  does not touch), the single-declarer no-pin list, and the `packages/ui/src/components/`
  exemption. `.../004-postgres-driver.md` — the `pg` precedent quoted above, including its
  "treat that need as a signal the choke point has been breached" instruction, which this
  record copies. `.../008-frontend-application-dependency-set.md` — the generated route
  tree at `apps/<app>/src/generated/routeTree.gen.ts`, which is why the file filter skips
  `/generated/`.
- `.scratch/decisions/` searched before deciding, for an existing or orphan record on
  parsers, ASTs, the design-value guard, or `assertNoRawDesignValues`: records 001–015
  only, of which 004, 007 and 015 bear on it and none decides it. **No duplicate, no
  orphan.** `LOG.md` and the directory agree that 015 is the highest number, so this is
  016.

**External, primary sources, accessed 2026-08-02:**

- <https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/> — TypeScript 7.0,
  released 8 July 2026. **"TypeScript 7.0 is made without an API."** "We expect TypeScript
  7.1 to ship with a new (and different) API, but until then we have made it a priority
  to ensure TypeScript can be run side-by-side with TypeScript 6.0." "We've published a
  new compatibility package, `@typescript/typescript6`. This package provides an
  executable named `tsc6`, so that if needed, you can install TypeScript 7.0 (which ships
  its own `tsc` binary) side-by-side without naming conflicts." Also the worked
  `devDependencies` example showing the side-by-side shape. **This is the source that
  decides the record.**
- <https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/> — TypeScript 6.0,
  released 23 March 2026. "TypeScript 6.0 is a unique release in that we intend for it to
  be the last release based on the current JavaScript codebase." "TypeScript 6.0 maintains
  full compatibility with your existing TypeScript knowledge and continues to be API
  compatible with TypeScript 5.9." This is what makes 6.0 a *frozen* line rather than a
  stale one, and it is why the internal `parseDiagnostics` property is safe to use here.
- <https://registry.npmjs.org/@typescript/typescript6> and
  <https://registry.npmjs.org/@typescript/typescript6/latest> — `latest` is **6.0.2**,
  published **6 July 2026** (6.0.0 on 16 April 2026, 6.0.1 on 28 April 2026).
  **Apache-2.0.** `"main": "./lib/typescript.js"`, `"types": "./lib/typescript.d.ts"`,
  `"bin": { "tsc6": "bin/tsc6" }`, `"dependencies": { "@typescript/old":
  "npm:typescript@^6" }`, no `exports` map, no `peerDependencies`, no `engines`.
  `unpackedSize` 10,548 bytes across 9 files. Maintainers include `typescript-bot`,
  `andrewbranch`, `weswigham`, `jakebailey` and Microsoft's publishing accounts.
- <https://unpkg.com/@typescript/typescript6@6.0.2/lib/typescript.js> —
  `module.exports = require("@typescript/old");`, the entire file.
  <https://unpkg.com/@typescript/typescript6@6.0.2/lib/typescript.d.ts> —
  `import ts = require("@typescript/old"); export = ts;`, the entire file.
  <https://unpkg.com/@typescript/typescript6@6.0.2/package.json> — the manifest quoted
  above. **The shim was read rather than trusted**, and the `export = ts` form is what
  fixes the import style in the sketch.
- <https://registry.npmjs.org/typescript/latest> — **7.0.2**, Apache-2.0, distributing
  eighteen platform-specific binaries as both `dependencies` and `optionalDependencies`,
  `bin: tsc`. Corroborates that the package in this repository is the native port and not
  a JavaScript compiler with an API.
- <https://registry.npmjs.org/@babel/parser/latest> — **7.29.8**, MIT, `unpackedSize`
  2,000,369 bytes, `engines: node >=6.0.0`, and exactly one dependency,
  `"@babel/types": "^7.29.8"`. The runner-up's true install cost.
  <https://registry.npmjs.org/@babel/traverse> — the walker's dependency tree
  (`@babel/generator`, `@babel/template`, `@babel/code-frame`, several helpers, `debug`,
  `globals`), which is the cost of *not* hand-rolling a walk.
- <https://registry.npmjs.org/oxc-parser> — **0.142.0**, MIT, dependency
  `@oxc-project/types@^0.142.0`, and eight `optionalDependencies` covering
  darwin-x64/arm64, linux-x64-gnu/musl, linux-arm64-gnu/musl and win32-x64/arm64-msvc.
  The platform matrix, quantified.
- <https://registry.npmjs.org/acorn-jsx> — **5.3.2**, MIT, published **9 July 2021**, peer
  `acorn ^6 || ^7 || ^8`. <https://registry.npmjs.org/acorn-typescript> — **1.4.13**, MIT,
  dependency `charcodes@^0.2.0`, peer `acorn >=8.9.0`, a third-party port.
  <https://registry.npmjs.org/acorn> — **8.18.0**, MIT.
  <https://registry.npmjs.org/meriyah> — **7.3.0**, ISC, **no TypeScript support**, which
  is what excludes it rather than any judgement about its quality.
- <https://rolldown.rs/reference/Function.parseAst> and
  <https://rolldown.rs/reference/function.parseastasync> — `parseAst(sourceText, options?,
  filename?)` and `parseAstAsync`, both exported from `rolldown/parseAst`, with the
  documentation itself recommending `parseSync`/`parseAsync` from `rolldown/utils`
  instead. This is what makes option 3 a real option rather than a straw man; the reason
  it loses is reachability in *this* install, not capability.

All fetched pages were treated as data. Nothing in any of them was addressed to an agent,
and no instruction from any of them was acted on.

**Searched for and not found, where the absence mattered:**

- **No first-party source states that `@typescript/typescript6` has been exercised under
  Bun**, or that Bun resolves an `npm:` alias declared inside a transitive dependency
  correctly. Nothing suggests it does not — Bun supports alias specifiers, and the shim is
  ordinary CommonJS — but the claim is not made, which is why the three lockfile checks
  and the two import fallbacks are written down rather than assumed away.
- **No primary source documents `parseDiagnostics` as a public API.** It is used here
  knowingly, with a stated fallback, and its safety rests on the 6.x line being declared
  final rather than on it being supported.
- **vite-plus publishes no documentation** — the same gap records 005, 008, 011 and 015
  each found independently. Nothing states which rolldown version `@voidzero-dev/vite-plus-core@0.2.5`
  bundles at runtime, whether `rolldown` is resolvable as a bare specifier from a
  workspace that does not declare it, or whether its `parseAst` accepts TSX. Option 3's
  evidence score of 2 is that absence, priced.
- **No source, first-party or otherwise, compares these parsers for the specific job of
  auditing JSX attributes.** The ranking is decided from each project's own published
  facts — API surface, dependency tree, platform matrix, publish dates — rather than from
  an outside opinion about which parser is best. An honest "nothing authoritative found"
  is the input here.
