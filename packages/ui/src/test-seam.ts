import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ponytail: catches a hex/arbitrary value, an assembled className, or any
// inline style, and fails loud (not silently) on unparsable input. Still
// can't see a class built inside an imported function, or via a prop.
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

const EXEMPT_COMMENT = /^\s*\/\/\s*design-exempt:\s*(.+)$/;

function isExempt(precedingLine: string | undefined): boolean {
  if (precedingLine === undefined) return false;
  const match = EXEMPT_COMMENT.exec(precedingLine);
  if (!match) return false;
  return match[1].trim().split(/\s+/).filter(Boolean).length >= 4;
}

// Skips past a quoted/template string starting at `quote`, honouring `\`
// escapes. Returns the index of the closing quote, or `text.length` if
// the string never closes — callers must check for that.
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

// Skips a string/template literal or a `//`/`/* */` comment starting at
// `i`, so bracket/comma scanners don't miscount a brace or comma that
// only exists inside one. Returns `i` unchanged if nothing starts there.
function skipNonCode(text: string, i: number): number {
  const ch = text[i];
  if (ch === '"' || ch === "'" || ch === "`") return skipString(text, i, ch);
  if (ch === "/" && text[i + 1] === "/") {
    const end = text.indexOf("\n", i);
    return end === -1 ? text.length - 1 : end - 1;
  }
  if (ch === "/" && text[i + 1] === "*") {
    const end = text.indexOf("*/", i + 2);
    return end === -1 ? text.length - 1 : end + 1;
  }
  return i;
}

// Returns the index of the `close` that matches the `open` at `start`,
// skipping strings/comments so a bracket-like character inside one
// doesn't count. -1 means no match was found — the caller must fail loud.
function matchBalanced(text: string, start: number, open: string, close: string): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const skipped = skipNonCode(text, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    const ch = text[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Splits a comma-separated argument list at top level, ignoring commas
// nested inside brackets/braces/parens, strings, or comments.
function splitTopLevelArgs(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const skipped = skipNonCode(text, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    const ch = text[i];
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

// A string/template literal covering the *whole* trimmed text — not just
// starting and ending with a quote character, so `"a" + b + "c"` fails.
function isStringLiteral(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  const quote = t[0];
  if (quote !== '"' && quote !== "'") return false;
  return skipString(t, 0, quote) === t.length - 1;
}

function stringContent(text: string): string {
  const t = text.trim();
  return t.slice(1, -1);
}

// Strips `//` and `/* */` comments, skipping string contents, so a comment
// inside a cn(...) argument doesn't get read as part of its text.
function stripComments(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const skipped = skipNonCode(text, i);
    if (skipped !== i) {
      if (text[i] !== "/") out += text.slice(i, skipped + 1);
      i = skipped;
      continue;
    }
    out += text[i];
  }
  return out;
}

// `const X = cva(...)` bindings declared anywhere in the file — the only
// other shape (besides a name ending `Variants`) that `cn()` may call.
const CVA_BINDING = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*cva\s*\(/g;

function collectCvaNames(source: string): Set<string> {
  const names = new Set<string>();
  CVA_BINDING.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CVA_BINDING.exec(source))) names.add(match[1]);
  return names;
}

// A bare `identifier(...)`, where the identifier is bound to `cva(...)`
// in this file or ends in `Variants` (`badgeVariants`, `buttonVariants`).
// Anything else is an opaque call the guard can't see inside — rejected.
function isSanctionedCall(text: string, cvaNames: Set<string>): boolean {
  const match = /^([A-Za-z_$][\w$]*)\s*\(/.exec(text);
  if (!match) return false;
  const closeIdx = matchBalanced(text, match[0].length - 1, "(", ")");
  if (closeIdx !== text.length - 1) return false;
  return cvaNames.has(match[1]) || match[1].endsWith("Variants");
}

// The last top-level `&&`, so `cond && "literal"` can be picked apart
// without caring what `cond` is (it is never a class string).
function lastTopLevelAnd(text: string): number {
  let depth = 0;
  let found = -1;
  for (let i = 0; i < text.length; i++) {
    const skipped = skipNonCode(text, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    const ch = text[i];
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (depth === 0 && ch === "&" && text[i + 1] === "&") {
      found = i;
      i++;
    }
  }
  return found;
}

// Splits `cond ? trueBranch : falseBranch` at the `?`/`:` pair belonging to
// the *first* top-level `?`, tracking a ternary-nesting depth so a nested
// ternary in `trueBranch` doesn't steal the wrong `:`. `cond` is dropped.
function splitTernary(text: string): { trueBranch: string; falseBranch: string } | null {
  let depth = 0;
  let qIndex = -1;
  for (let i = 0; i < text.length; i++) {
    const skipped = skipNonCode(text, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    const ch = text[i];
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (depth === 0 && ch === "?" && text[i + 1] !== ".") {
      qIndex = i;
      break;
    }
  }
  if (qIndex === -1) return null;

  depth = 0;
  let ternaryDepth = 0;
  for (let i = qIndex + 1; i < text.length; i++) {
    const skipped = skipNonCode(text, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    const ch = text[i];
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    else if (depth === 0 && ch === "?" && text[i + 1] !== ".") ternaryDepth++;
    else if (depth === 0 && ch === ":") {
      if (ternaryDepth === 0) {
        return {
          trueBranch: text.slice(qIndex + 1, i).trim(),
          falseBranch: text.slice(i + 1).trim(),
        };
      }
      ternaryDepth--;
    }
  }
  return null;
}

interface Classification {
  rawValue: boolean;
  assembled: boolean;
}

// One argument to a `cn(...)` call: a string literal, the `className` prop,
// `cond && "literal"`, `cond ? a : b` where both branches are themselves
// valid arguments, or a sanctioned call. Anything else is assembled.
function classifyCnArg(arg: string, cvaNames: Set<string>): Classification {
  const trimmed = stripComments(arg).trim();
  if (isStringLiteral(trimmed))
    return { rawValue: hasRawValue(stringContent(trimmed)), assembled: false };
  if (trimmed === "className") return { rawValue: false, assembled: false };

  const ternary = splitTernary(trimmed);
  if (ternary) {
    const trueResult = classifyCnArg(ternary.trueBranch, cvaNames);
    const falseResult = classifyCnArg(ternary.falseBranch, cvaNames);
    if (!trueResult.assembled && !falseResult.assembled) {
      return { rawValue: trueResult.rawValue || falseResult.rawValue, assembled: false };
    }
    return { rawValue: false, assembled: true };
  }

  const andIndex = lastTopLevelAnd(trimmed);
  if (andIndex !== -1) {
    const rhs = trimmed.slice(andIndex + 2).trim();
    if (isStringLiteral(rhs))
      return { rawValue: hasRawValue(stringContent(rhs)), assembled: false };
  }

  if (isSanctionedCall(trimmed, cvaNames)) return { rawValue: false, assembled: false };
  return { rawValue: false, assembled: true };
}

// The full `className` value: a string literal, or a `cn(...)` call whose
// arguments are each valid per `classifyCnArg`. Anything else — a bare
// identifier, a concatenation, an element-access lookup — is banned.
function classifySite(raw: string, cvaNames: Set<string>): Classification {
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
          const result = classifyCnArg(arg, cvaNames);
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

interface AttributeSite {
  attrIndex: number;
  raw: string;
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

// Finds every `<attr>={...}` / `<attr>="..."` occurrence, without parsing
// the rest of the TypeScript. Throws, naming the file and line, if a
// value can't be extracted — a guard that stops scanning must say so.
function findAttributeSites(source: string, filePath: string, attr: string): AttributeSite[] {
  const regex = new RegExp(`\\b${attr}\\s*=\\s*`, "g");
  const sites: AttributeSite[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) {
    const attrIndex = match.index;
    const valueStart = match.index + match[0].length;
    const ch = source[valueStart];
    const line = lineAt(source, attrIndex);
    if (ch === '"' || ch === "'") {
      const end = skipString(source, valueStart, ch);
      if (source[end] !== ch) {
        throw new Error(`${filePath}:${line}: unterminated ${attr} string value`);
      }
      sites.push({ attrIndex, raw: source.slice(valueStart, end + 1) });
    } else if (ch === "{") {
      const end = matchBalanced(source, valueStart, "{", "}");
      if (end === -1) {
        throw new Error(`${filePath}:${line}: cannot find the end of the ${attr} expression`);
      }
      sites.push({ attrIndex, raw: source.slice(valueStart, end + 1) });
    } else {
      throw new Error(`${filePath}:${line}: cannot determine the ${attr} value`);
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

// Raw design value + className-assembly + inline-style guard. rule 6 in
// docs/agents/code-standards.md; .scratch/foundation/issues/12. Escape
// hatch: `// design-exempt: <reason>` (4+ words), line above the offender.
export function assertNoRawDesignValues(dir: string): void {
  const rawValueOffenders: string[] = [];
  const assemblyOffenders: string[] = [];

  for (const filePath of collectFiles(dir).filter((path) => /\.tsx?$/.test(path))) {
    const source = readFileSync(filePath, "utf8");
    const lines = source.split("\n");
    const cvaNames = collectCvaNames(source);

    for (const site of findAttributeSites(source, filePath, "style")) {
      const lineIndex = lineAt(source, site.attrIndex) - 1;
      if (isExempt(lines[lineIndex - 1])) continue;
      rawValueOffenders.push(`${filePath}:${lineIndex + 1}`);
    }

    for (const site of findAttributeSites(source, filePath, "className")) {
      const lineIndex = lineAt(source, site.attrIndex) - 1;
      if (isExempt(lines[lineIndex - 1])) continue;
      const { rawValue, assembled } = classifySite(site.raw, cvaNames);
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
        `cn(...) with literal/className/cond && "literal"/cond ? a : b/cva arguments — code-standards.md rule 6) in:\n${assemblyOffenders.join("\n")}`,
    );
  }
  if (messages.length > 0) throw new Error(messages.join("\n\n"));
}
