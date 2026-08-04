import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { isContractProcedure } from "@orpc/contract";
import { contract } from "contract/src/contract.ts";
import { describe, expect, it } from "vite-plus/test";

// Issue 13 / record 062: every procedure must carry a wrong-tenant probe.
// The contract is walked at run time (a parser can't see a spread-added
// procedure); a probe links to its procedure via a bracketed tag in its name.
function collectContractPaths(node: unknown, prefix: string[] = []): string[] {
  if (isContractProcedure(node)) return [prefix.join(".")];
  if (node && typeof node === "object") {
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
      collectContractPaths(value, [...prefix, key]),
    );
  }
  return [];
}
const contractPaths = collectContractPaths(contract);

const testsDir = resolve(dirname(fileURLToPath(import.meta.url)));
const guardFileName = fileURLToPath(import.meta.url)
  .split("/")
  .pop()!;

function collectTestFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return /\.test\.tsx?$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap((entry) => collectTestFiles(join(path, entry)));
}
const testFiles = collectTestFiles(testsDir).filter((file) => !file.endsWith(guardFileName));

const TAG = /wrong-tenant probe \[([\w.]+)\]/;
const IT_OPEN = /\b(?:it|test)(\.skip|\.todo|\.skipIf\([^)]*\)|\.runIf\([^)]*\))?\s*\(/g;
const DESCRIBE_OPEN = /\bdescribe(\.skip|\.skipIf\([^)]*\)|\.runIf\([^)]*\))?\s*\(/g;
const CONDITIONAL_DESCRIBE = /\bdescribe(\.skip|\.skipIf\([^)]*\)|\.runIf\([^)]*\))\s*\(/;
const NAME_LITERAL = /^\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/;
const REGEX_PRECEDERS = /[([{,;:=&|!?+\-*/%~^<>]/;
const IDENTIFIER_CHAR = /[A-Za-z0-9_$]/;
// Keywords after which a bare identifier can't stand, so a following "/" is
// unambiguously a regex, not division — real code uses these constantly
// (e.g. `return /foo/.test(x)`), unlike an arbitrary identifier.
const REGEX_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "throw",
  "new",
  "delete",
  "void",
  "yield",
  "case",
  "do",
  "else",
  "await",
  "in",
  "of",
]);

type Probe = {
  file: string;
  name: string;
  tag: string | null;
  skipped: boolean;
  body: string;
};

// Refuses to classify: never guess between a regex and a division, or peer
// into a template substitution that nests another template literal.
class LexAmbiguityError extends Error {}

function fail(file: string, offset: number, reason: string): never {
  throw new LexAmbiguityError(
    `wrong-tenant probe coverage: ${file} offset ${offset}: ${reason} — refusing to guess.`,
  );
}

// The identifier run immediately before position `i`, skipping whitespace —
// used to tell a regex-preceding keyword (`return /x/`) from a variable.
function wordBefore(contents: string, i: number): string {
  let j = i - 1;
  while (j >= 0 && /\s/.test(contents[j]!)) j--;
  const end = j + 1;
  while (j >= 0 && IDENTIFIER_CHAR.test(contents[j]!)) j--;
  return contents.slice(j + 1, end);
}

// A `${...}` substitution is real code: braces nest, quotes stand alone, but
// a backtick inside it opens a nested template this lexer cannot follow —
// that construct fails closed rather than being guessed at.
function consumeSubstitution(contents: string, start: number, file: string): number {
  let depth = 1;
  let i = start;
  while (i < contents.length) {
    const char = contents[i]!;
    if (char === "`") fail(file, i, "a template substitution nests another template literal");
    if (char === "'" || char === '"') {
      const quote = char;
      i++;
      while (i < contents.length && contents[i] !== quote) i += contents[i] === "\\" ? 2 : 1;
      i++;
      continue;
    }
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return fail(file, start, "an unterminated template substitution");
}

function consumeTemplate(contents: string, start: number, isCode: boolean[], file: string): number {
  isCode[start] = false;
  let i = start + 1;
  while (i < contents.length) {
    if (contents[i] === "\\") {
      isCode[i] = false;
      if (i + 1 < contents.length) isCode[i + 1] = false;
      i += 2;
      continue;
    }
    if (contents[i] === "`") {
      isCode[i] = false;
      return i + 1;
    }
    if (contents[i] === "$" && contents[i + 1] === "{") {
      isCode[i] = false;
      isCode[i + 1] = false;
      i = consumeSubstitution(contents, i + 2, file);
      continue;
    }
    isCode[i] = false;
    i++;
  }
  return i;
}

// Classifies every character as code or not — string, template literal,
// regex literal, or comment — so a tagged `it(...)` in prose or a comment
// is never mistaken for a real test.
function classifyChars(contents: string, file: string): boolean[] {
  const isCode = Array.from<boolean>({ length: contents.length }).fill(true);
  let lastSignificant = "";
  let i = 0;
  while (i < contents.length) {
    const char = contents[i]!;
    if (char === "/" && contents[i + 1] === "/") {
      const nextNewline = contents.indexOf("\n", i);
      const end = nextNewline === -1 ? contents.length : nextNewline;
      for (let j = i; j < end; j++) isCode[j] = false;
      i = end;
      continue;
    }
    if (char === "/" && contents[i + 1] === "*") {
      const close = contents.indexOf("*/", i + 2);
      const end = close === -1 ? contents.length : close + 2;
      for (let j = i; j < end; j++) isCode[j] = false;
      i = end;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      isCode[i] = false;
      i++;
      while (i < contents.length) {
        isCode[i] = false;
        if (contents[i] === "\\") {
          if (i + 1 < contents.length) isCode[i + 1] = false;
          i += 2;
          continue;
        }
        if (contents[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      lastSignificant = quote;
      continue;
    }
    if (char === "`") {
      i = consumeTemplate(contents, i, isCode, file);
      lastSignificant = "`";
      continue;
    }
    if (char === "/") {
      const regexContext =
        lastSignificant === "" ||
        REGEX_PRECEDERS.test(lastSignificant) ||
        (IDENTIFIER_CHAR.test(lastSignificant) && REGEX_KEYWORDS.has(wordBefore(contents, i)));
      if (regexContext) {
        let j = i + 1;
        let inClass = false;
        let closed = false;
        while (j < contents.length && contents[j] !== "\n") {
          if (contents[j] === "\\") {
            j += 2;
            continue;
          }
          if (contents[j] === "[") inClass = true;
          else if (contents[j] === "]") inClass = false;
          else if (contents[j] === "/" && !inClass) {
            j++;
            closed = true;
            break;
          }
          j++;
        }
        if (closed) {
          for (let k = i; k < j; k++) isCode[k] = false;
          i = j;
          lastSignificant = "/";
          continue;
        }
        // Not actually a regex (an unterminated `/` before a newline) — a
        // bare division, left as code.
      } else if (IDENTIFIER_CHAR.test(lastSignificant)) {
        fail(file, i, `an ambiguous "/" could open a regex literal or be division`);
      }
    }
    if (!/\s/.test(char)) lastSignificant = char;
    i++;
  }
  return isCode;
}

function maskNonCode(contents: string, isCode: boolean[]): string {
  let masked = "";
  for (let i = 0; i < contents.length; i++) masked += isCode[i] ? contents[i] : " ";
  return masked;
}

// Walks paren depth from a call's opening paren using the same code/non-code
// classification as the candidate search, so a name or a comment can never
// contribute a stray paren or quote to the walk.
function matchingParenEnd(contents: string, isCode: boolean[], openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < contents.length; i++) {
    if (!isCode[i]) continue;
    const char = contents[i];
    if (char === "(") depth++;
    else if (char === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

type CallBlock = {
  keywordStart: number;
  bodyStart: number;
  bodyEnd: number;
  skipModifier: string | undefined;
};

function extractCallBlocks(contents: string, isCode: boolean[], openRe: RegExp): CallBlock[] {
  const blocks: CallBlock[] = [];
  for (const match of contents.matchAll(openRe)) {
    if (!isCode[match.index]) continue;
    const openIndex = match.index + match[0].length - 1;
    const end = matchingParenEnd(contents, isCode, openIndex);
    if (end < openIndex) continue;
    blocks.push({
      keywordStart: match.index,
      bodyStart: openIndex + 1,
      bodyEnd: end,
      skipModifier: match[1],
    });
  }
  return blocks;
}

function matchingBraceEnd(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// True if `text` (a describe body with every nested it/describe call already
// blanked out) returns before reaching its end — an early exit that would
// stop a nested `it(...)` from ever registering.
function hasTopLevelControlFlowReturn(text: string): boolean {
  const allCode = Array.from<boolean>({ length: text.length }).fill(true);
  for (const match of text.matchAll(/\bif\s*\(/g)) {
    const openIndex = match.index + match[0].length - 1;
    const condEnd = matchingParenEnd(text, allCode, openIndex);
    if (condEnd < 0) continue;
    let i = condEnd + 1;
    while (i < text.length && /\s/.test(text[i]!)) i++;
    if (/^return\b/.test(text.slice(i))) return true;
    if (text[i] === "{") {
      const blockEnd = matchingBraceEnd(text, i);
      if (blockEnd > i && /\breturn\b/.test(text.slice(i + 1, blockEnd))) return true;
    }
  }
  return false;
}

// Blanks every nested it/test/describe call body so what remains is a
// describe's own top-level statements — a guard inside a nested call belongs
// to that call's scope, not this one's.
function ownTopLevelText(contents: string, block: CallBlock, nested: CallBlock[]): string {
  const chars = contents.slice(block.bodyStart, block.bodyEnd).split("");
  for (const n of nested) {
    if (n === block || n.bodyStart <= block.bodyStart || n.bodyEnd >= block.bodyEnd) continue;
    for (let i = n.bodyStart; i < n.bodyEnd; i++) chars[i - block.bodyStart] = " ";
  }
  return chars.join("");
}

function extractProbes(contents: string, file: string): Probe[] {
  const isCode = classifyChars(contents, file);
  const masked = maskNonCode(contents, isCode);
  const fileSkipsDescribe = CONDITIONAL_DESCRIBE.test(masked);

  const describeBlocks = extractCallBlocks(contents, isCode, DESCRIBE_OPEN);
  const itBlocks = extractCallBlocks(contents, isCode, IT_OPEN);
  const nested = [...describeBlocks, ...itBlocks];
  const guardedDescribes = describeBlocks.filter((d) =>
    hasTopLevelControlFlowReturn(ownTopLevelText(masked, d, nested)),
  );

  const probes: Probe[] = [];
  for (const block of itBlocks) {
    const nameMatch = contents.slice(block.bodyStart).match(NAME_LITERAL);
    if (!nameMatch) continue;
    const name = nameMatch[1] ?? nameMatch[2] ?? nameMatch[3] ?? "";
    const body = contents.slice(block.bodyStart, block.bodyEnd);
    const tagMatch = name.match(TAG);
    const controlFlowGuarded = guardedDescribes.some(
      (d) => block.keywordStart > d.bodyStart && block.keywordStart < d.bodyEnd,
    );

    probes.push({
      file,
      name,
      tag: tagMatch ? tagMatch[1]! : null,
      skipped: Boolean(block.skipModifier) || fileSkipsDescribe || controlFlowGuarded,
      body,
    });
  }
  return probes;
}

const allProbes = testFiles.flatMap((file) => extractProbes(readFileSync(file, "utf8"), file));
const taggedProbes = allProbes.filter((probe) => probe.tag !== null);

describe("wrong-tenant probe coverage", () => {
  it("every contract path has a wrong-tenant probe", () => {
    const tagged = new Set(taggedProbes.map((probe) => probe.tag));
    const missing = contractPaths.filter((path) => !tagged.has(path));
    expect(
      missing,
      missing
        .map(
          (path) =>
            `wrong-tenant probe coverage: no probe for "${path}". Add a test named: wrong-tenant probe [${path}]: <what it proves>`,
        )
        .join("\n"),
    ).toStrictEqual([]);
  });

  it("every tag names a real contract path", () => {
    const offenders = taggedProbes
      .filter((probe) => !contractPaths.includes(probe.tag!))
      .map(
        (probe) =>
          `wrong-tenant probe coverage: tag [${probe.tag}] names no procedure in the contract. Retag it or delete it.`,
      );
    expect(offenders).toStrictEqual([]);
  });

  it("every tagged probe calls the procedure it claims to cover", () => {
    const offenders = taggedProbes
      .filter((probe) => !new RegExp(`\\.${probe.tag!.replace(/\./g, "\\.")}\\(`).test(probe.body))
      .map(
        (probe) =>
          `wrong-tenant probe coverage: the probe tagged [${probe.tag}] never calls ${probe.tag}.`,
      );
    expect(offenders).toStrictEqual([]);
  });

  it("every tagged probe calls expectWrongTenantRefusal", () => {
    const offenders = taggedProbes
      .filter((probe) => !probe.body.includes("expectWrongTenantRefusal"))
      .map(
        (probe) =>
          `wrong-tenant probe coverage: the probe tagged [${probe.tag}] does not call expectWrongTenantRefusal.`,
      );
    expect(offenders).toStrictEqual([]);
  });

  it("no tagged probe is skipped", () => {
    const offenders = taggedProbes
      .filter((probe) => probe.skipped)
      .map((probe) => `wrong-tenant probe coverage: the probe tagged [${probe.tag}] is skipped.`);
    expect(offenders).toStrictEqual([]);
  });
});

// Proves the scanner catches a real regression, not only that the repo is
// currently clean — the precedent pin-no-logging-grep.test.ts sets.
describe("scanner regressions", () => {
  it("catches a probe tagged for a path it never calls", () => {
    const contents = [
      'it("wrong-tenant probe [store.update]: does not actually call it", async () => {',
      "  await expectWrongTenantRefusal({});",
      "});",
    ].join("\n");
    const [probe] = extractProbes(contents, "fake.test.ts");
    expect(new RegExp(`\\.${probe!.tag!.replace(/\./g, "\\.")}\\(`).test(probe!.body)).toBe(false);
  });

  it("catches a skipped tagged probe", () => {
    const contents = 'it.skip("wrong-tenant probe [store.update]: skipped", async () => {});';
    const [probe] = extractProbes(contents, "fake.test.ts");
    expect(probe!.skipped).toBe(true);
  });

  it("catches a multi-line probe body via paren depth, not a single-line regex", () => {
    const contents = [
      'it("wrong-tenant probe [store.update]: multi line", async () => {',
      "  await client.store.update(",
      "    { id },",
      "  );",
      "  await expectWrongTenantRefusal({});",
      "});",
    ].join("\n");
    const [probe] = extractProbes(contents, "fake.test.ts");
    expect(probe!.body.includes("expectWrongTenantRefusal")).toBe(true);
  });

  it("an apostrophe inside a // comment doesn't corrupt the block extraction", () => {
    const contents = [
      'it("wrong-tenant probe [store.update]: has a comment", async () => {',
      "  // B's own path succeeds first",
      "  await client.store.update({ id });",
      "  await expectWrongTenantRefusal({});",
      "});",
    ].join("\n");
    const [probe] = extractProbes(contents, "fake.test.ts");
    expect(probe!.body.includes("expectWrongTenantRefusal")).toBe(true);
  });

  it("a tagged it(...) inside a normal string is not a probe", () => {
    const contents =
      "const fixture = 'it(\"wrong-tenant probe [store.update]: fake\", async () => { await client.store.update(); await expectWrongTenantRefusal({}); });';";
    expect(extractProbes(contents, "fake.test.ts")).toStrictEqual([]);
  });

  it("a tagged it(...) inside a template literal is not a probe", () => {
    const contents =
      'const fixture = `it("wrong-tenant probe [store.update]: fake", async () => { await client.store.update(); await expectWrongTenantRefusal({}); });`;';
    expect(extractProbes(contents, "fake.test.ts")).toStrictEqual([]);
  });

  it("a tagged it(...) inside a block comment is not a probe", () => {
    const contents = [
      "/*",
      'it("wrong-tenant probe [store.update]: fake", async () => {',
      "  await client.store.update();",
      "  await expectWrongTenantRefusal({});",
      "});",
      "*/",
    ].join("\n");
    expect(extractProbes(contents, "fake.test.ts")).toStrictEqual([]);
  });

  it("a tagged it(...) inside a regex literal is not a probe", () => {
    const contents = String.raw`const pattern = /it\("wrong-tenant probe \[store\.update\]: fake"\)/;`;
    expect(extractProbes(contents, "fake.test.ts")).toStrictEqual([]);
  });

  it("a real probe whose name uses escaped quotes is still found and parsed", () => {
    const contents = String.raw`it("wrong-tenant probe [store.update]: has \"escaped\" quotes", async () => {
  await client.store.update();
  await expectWrongTenantRefusal({});
});`;
    const [probe] = extractProbes(contents, "fake.test.ts");
    expect(probe!.tag).toBe("store.update");
    expect(probe!.body.includes("expectWrongTenantRefusal")).toBe(true);
  });

  it("rejects it.skipIf as skipped regardless of the condition", () => {
    const contents =
      'it.skipIf(true)("wrong-tenant probe [store.update]: conditional", async () => { await client.store.update(); await expectWrongTenantRefusal({}); });';
    const [probe] = extractProbes(contents, "fake.test.ts");
    expect(probe!.skipped).toBe(true);
  });

  it("rejects it.runIf as skipped regardless of the condition", () => {
    const contents =
      'it.runIf(false)("wrong-tenant probe [store.update]: conditional", async () => { await client.store.update(); await expectWrongTenantRefusal({}); });';
    const [probe] = extractProbes(contents, "fake.test.ts");
    expect(probe!.skipped).toBe(true);
  });

  it("rejects a describe.skipIf suite wrapping a tagged probe", () => {
    const contents = [
      'describe.skipIf(true)("suite", () => {',
      '  it("wrong-tenant probe [store.update]: conditional describe", async () => {',
      "    await client.store.update();",
      "    await expectWrongTenantRefusal({});",
      "  });",
      "});",
    ].join("\n");
    const [probe] = extractProbes(contents, "fake.test.ts");
    expect(probe!.skipped).toBe(true);
  });

  it("rejects a tagged probe an enclosing describe's control flow can skip past", () => {
    const contents = [
      'describe("suite", () => {',
      "  if (skipThisSuite) return;",
      '  it("wrong-tenant probe [store.update]: guarded", async () => {',
      "    await client.store.update();",
      "    await expectWrongTenantRefusal({});",
      "  });",
      "});",
    ].join("\n");
    const [probe] = extractProbes(contents, "fake.test.ts");
    expect(probe!.skipped).toBe(true);
  });

  it("fails closed on a template literal nested inside a substitution", () => {
    const contents = [
      "const fixture = `outer ${`inner ${x}`} more`;",
      'it("wrong-tenant probe [store.update]: fake", async () => {',
      "  await client.store.update();",
      "  await expectWrongTenantRefusal({});",
      "});",
    ].join("\n");
    expect(() => extractProbes(contents, "fake.test.ts")).toThrow(/nests another template literal/);
  });

  it("a regex literal after return is read as a regex, not division, and does not unmask a fake probe hidden in a string", () => {
    const contents = [
      "function isMatch(value) {",
      "  return /store\\.update/.test(value);",
      "}",
      "const fixture = 'it(\"wrong-tenant probe [store.update]: fake\", async () => { await client.store.update(); await expectWrongTenantRefusal({}); });';",
    ].join("\n");
    expect(extractProbes(contents, "fake.test.ts")).toStrictEqual([]);
  });

  it("fails closed on a bare identifier before / — genuinely ambiguous between regex and division", () => {
    const contents = 'it("x", () => { return count /divisor/.test(value); });';
    expect(() => extractProbes(contents, "fake.test.ts")).toThrow(/ambiguous "\/"/);
  });

  it("names the file and the character offset it refuses to classify", () => {
    const contents = 'it("x", () => { return count /divisor/.test(value); });';
    try {
      extractProbes(contents, "offender.test.ts");
      throw new Error("expected extractProbes to throw");
    } catch (error) {
      expect((error as Error).message).toContain("offender.test.ts");
      expect((error as Error).message).toMatch(/offset \d+/);
    }
  });
});
