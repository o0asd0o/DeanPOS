import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ponytail: scans `className` attribute contents only — it is not a CSS or
// TS parser and cannot see a colour assembled at runtime or a value
// arriving through a prop. A `cn(...)` call argument that is itself a
// function call is assumed to be a cva variants call (the only sanctioned
// shape); the guard has no type info to confirm that, so `cn(getClasses())`
// would incorrectly pass.
const HEX_LITERAL = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/;

// `<utility>-[<value>]` has no trailing colon; an arbitrary variant like
// `data-[state=open]:` does — that colon is what tells the two apart.
const ARBITRARY_VALUE = /[\w-]+-\[[^\]\s]*\](?!:)/;

// Arbitrary *properties* have no utility prefix and no regex tracks bracket
// nesting, so this scans each `[...]` to its matching close: `:` right after
// the close is a variant (ignore); `:` inside the unnested content is a property (flag).
function hasArbitraryProperty(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "[") continue;
    let depth = 1;
    let topLevelColon = false;
    let j = i + 1;
    for (; j < text.length && depth > 0; j++) {
      if (text[j] === "[") depth++;
      else if (text[j] === "]") depth--;
      else if (text[j] === ":" && depth === 1) topLevelColon = true;
    }
    if (depth !== 0) continue; // unmatched bracket — not our concern here
    if (text[j] !== ":" && topLevelColon) return true;
    i = j - 1;
  }
  return false;
}

function hasRawValue(content: string): boolean {
  return (
    HEX_LITERAL.test(content) || ARBITRARY_VALUE.test(content) || hasArbitraryProperty(content)
  );
}

const INLINE_STYLE = /style=\{\{/;

const EXEMPT_COMMENT = /^\s*\/\/\s*design-exempt:\s*(.+)$/;

function isExempt(precedingLine: string | undefined): boolean {
  if (precedingLine === undefined) return false;
  const match = EXEMPT_COMMENT.exec(precedingLine);
  if (!match) return false;
  return match[1].trim().split(/\s+/).filter(Boolean).length >= 4;
}

// Skips past a quoted/template string starting at `quote`, honouring `\`
// escapes, so a `)`/`}`/`,` inside a string never unbalances a scan.
function skipString(text: string, start: number, quote: string): number {
  let i = start + 1;
  for (; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] === quote) return i;
  }
  return i;
}

// Returns the index of the `close` that matches the `open` at `start`,
// skipping string contents so quotes/brackets inside them don't count.
function matchBalanced(text: string, start: number, open: string, close: string): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(text, i, ch);
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Splits a comma-separated argument list at top level, ignoring commas
// nested inside brackets/braces/parens or inside strings.
function splitTopLevelArgs(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(text, i, ch);
      continue;
    }
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (ch === "," && depth === 0) {
      args.push(text.slice(start, i));
      start = i + 1;
    }
  }
  const last = text.slice(start);
  if (last.trim().length > 0) args.push(last);
  return args.map((arg) => arg.trim());
}

function isStringLiteral(text: string): boolean {
  const t = text.trim();
  return (
    (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) ||
    (t.length >= 2 && t.startsWith("'") && t.endsWith("'"))
  );
}

function stringContent(text: string): string {
  const t = text.trim();
  return t.slice(1, -1);
}

// A bare `identifier(...)` covering the whole expression — the shape of a
// cva variants call (`badgeVariants({ variant })`). Sanctioned; see the
// ponytail note above on what this can't verify.
function isCallExpression(text: string): boolean {
  const match = /^[A-Za-z_$][\w$]*\s*\(/.exec(text);
  if (!match) return false;
  const closeIdx = matchBalanced(text, match[0].length - 1, "(", ")");
  return closeIdx === text.length - 1;
}

// The last top-level `&&`, so `cond && "literal"` can be picked apart
// without caring what `cond` is (it is never a class string).
function lastTopLevelAnd(text: string): number {
  let depth = 0;
  let found = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i = skipString(text, i, ch);
      continue;
    }
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (depth === 0 && ch === "&" && text[i + 1] === "&") {
      found = i;
      i++;
    }
  }
  return found;
}

interface Classification {
  rawValue: boolean;
  assembled: boolean;
}

// Strips `//` and `/* */` comments, skipping string contents, so a comment
// between two cn(...) arguments doesn't get read as part of the argument.
function stripComments(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const end = skipString(text, i, ch);
      out += text.slice(i, end + 1);
      i = end;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end - 1;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
      continue;
    }
    out += ch;
  }
  return out;
}

// One argument to a `cn(...)` call: a string literal, the `className` prop,
// `cond && "literal"`, or a cva variants call. Anything else is a class
// string assembled outside the attribute.
function classifyCnArg(arg: string): Classification {
  const trimmed = stripComments(arg).trim();
  if (isStringLiteral(trimmed))
    return { rawValue: hasRawValue(stringContent(trimmed)), assembled: false };
  if (trimmed === "className") return { rawValue: false, assembled: false };

  const andIndex = lastTopLevelAnd(trimmed);
  if (andIndex !== -1) {
    const rhs = trimmed.slice(andIndex + 2).trim();
    if (isStringLiteral(rhs))
      return { rawValue: hasRawValue(stringContent(rhs)), assembled: false };
  }

  if (isCallExpression(trimmed)) return { rawValue: false, assembled: false };
  return { rawValue: false, assembled: true };
}

// The full `className` value: a string literal, or a `cn(...)` call whose
// arguments are each valid per `classifyCnArg`. Anything else — a bare
// identifier, a template literal, an element-access lookup — is banned.
function classifySite(raw: string): Classification {
  if (raw.startsWith('"') || raw.startsWith("'")) {
    return { rawValue: hasRawValue(stringContent(raw)), assembled: false };
  }

  const expr = raw.slice(1, -1).trim(); // strip the JSX expression container's { }
  if (isStringLiteral(expr))
    return { rawValue: hasRawValue(stringContent(expr)), assembled: false };

  const cnOpen = /^cn\s*\(/.exec(expr);
  if (cnOpen) {
    const closeIdx = matchBalanced(expr, cnOpen[0].length - 1, "(", ")");
    if (closeIdx === expr.length - 1) {
      const args = splitTopLevelArgs(expr.slice(cnOpen[0].length, closeIdx));
      return args.reduce<Classification>(
        (acc, arg) => {
          const result = classifyCnArg(arg);
          return {
            rawValue: acc.rawValue || result.rawValue,
            assembled: acc.assembled || result.assembled,
          };
        },
        { rawValue: false, assembled: false },
      );
    }
  }

  return { rawValue: false, assembled: true };
}

interface ClassNameSite {
  attrIndex: number;
  raw: string;
}

const CLASSNAME_ATTR = /\bclassName\s*=\s*/g;

// Finds every `className={...}` / `className="..."` value in a file's
// source text, without parsing the rest of the TypeScript around it.
function findClassNameSites(source: string): ClassNameSite[] {
  const sites: ClassNameSite[] = [];
  CLASSNAME_ATTR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CLASSNAME_ATTR.exec(source))) {
    const attrIndex = match.index;
    const valueStart = match.index + match[0].length;
    const ch = source[valueStart];
    if (ch === '"' || ch === "'") {
      const end = skipString(source, valueStart, ch);
      sites.push({ attrIndex, raw: source.slice(valueStart, end + 1) });
    } else if (ch === "{") {
      const end = matchBalanced(source, valueStart, "{", "}");
      if (end !== -1) sites.push({ attrIndex, raw: source.slice(valueStart, end + 1) });
    }
  }
  return sites;
}

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    return statSync(fullPath).isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

// Raw design value + className-assembly guard for application code.
// docs/agents/code-standards.md rule 6; .scratch/foundation/issues/12.
// Escape hatch: `// design-exempt: <reason>` (4+ words) on the line
// immediately above the offending line.
export function assertNoRawDesignValues(dir: string): void {
  const rawValueOffenders: string[] = [];
  const assemblyOffenders: string[] = [];

  for (const filePath of collectFiles(dir).filter((path) => /\.tsx?$/.test(path))) {
    const source = readFileSync(filePath, "utf8");
    const lines = source.split("\n");

    lines.forEach((line, index) => {
      if (!INLINE_STYLE.test(line)) return;
      if (isExempt(lines[index - 1])) return;
      rawValueOffenders.push(`${filePath}:${index + 1}`);
    });

    for (const site of findClassNameSites(source)) {
      const lineIndex = source.slice(0, site.attrIndex).split("\n").length - 1;
      if (isExempt(lines[lineIndex - 1])) continue;
      const { rawValue, assembled } = classifySite(site.raw);
      if (rawValue) rawValueOffenders.push(`${filePath}:${lineIndex + 1}`);
      if (assembled) assemblyOffenders.push(`${filePath}:${lineIndex + 1}`);
    }
  }

  const messages: string[] = [];
  if (rawValueOffenders.length > 0) {
    messages.push(`Raw design values found in:\n${rawValueOffenders.join("\n")}`);
  }
  if (assemblyOffenders.length > 0) {
    messages.push(
      `className assembled outside the attribute (use a component variant, or ` +
        `cn(...) with literal/className/cond && "literal"/cva arguments — code-standards.md rule 6) in:\n${assemblyOffenders.join("\n")}`,
    );
  }
  if (messages.length > 0) throw new Error(messages.join("\n\n"));
}
