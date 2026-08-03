import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { isContractProcedure } from "@orpc/contract";
import { contract } from "contract/src/contract.ts";
import { describe, expect, it } from "vite-plus/test";

// Issue 13 / record 062: every procedure the contract exposes must carry a
// wrong-tenant probe. The contract is walked at run time with the vendor's
// own leaf test, not parsed — a hand-rolled parser can't see a procedure
// added by a spread. The probe is linked to a procedure by a bracketed tag
// in its own test name, checked both ways.
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
const CONDITIONAL_DESCRIBE = /\bdescribe(\.skip|\.skipIf\([^)]*\)|\.runIf\([^)]*\))\s*\(/;
const NAME_LITERAL = /^\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/;
const REGEX_PRECEDERS = /[([{,;:=&|!?+\-*/%~^<>]/;

type Probe = {
  file: string;
  name: string;
  tag: string | null;
  skipped: boolean;
  body: string;
};

// Classifies every character as code or not — string, template literal,
// regex literal, or comment — so a tagged `it(...)` in prose or a comment
// is never mistaken for a real test.
function classifyChars(contents: string): boolean[] {
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
    if (char === '"' || char === "'" || char === "`") {
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
    if (char === "/" && (lastSignificant === "" || REGEX_PRECEDERS.test(lastSignificant))) {
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
      // Not actually a regex (an unterminated `/` before a newline) — a bare
      // division, left as code.
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

// Walks paren depth from an `it(`/`test(` opening paren using the same
// code/non-code classification as the candidate search, so a probe name
// or a comment can never contribute a stray paren or quote to the walk.
function extractProbes(contents: string, file: string): Probe[] {
  const isCode = classifyChars(contents);
  const fileSkipsDescribe = CONDITIONAL_DESCRIBE.test(maskNonCode(contents, isCode));
  const probes: Probe[] = [];

  for (const match of contents.matchAll(IT_OPEN)) {
    if (!isCode[match.index]) continue;
    const openIndex = match.index + match[0].length - 1;
    const nameMatch = contents.slice(openIndex + 1).match(NAME_LITERAL);
    if (!nameMatch) continue;
    const name = nameMatch[1] ?? nameMatch[2] ?? nameMatch[3] ?? "";

    let depth = 0;
    let end = -1;
    for (let i = openIndex; i < contents.length; i++) {
      if (!isCode[i]) continue;
      const char = contents[i];
      if (char === "(") depth++;
      else if (char === ")") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < openIndex) continue;
    const body = contents.slice(openIndex + 1, end);
    const tagMatch = name.match(TAG);

    probes.push({
      file,
      name,
      tag: tagMatch ? tagMatch[1]! : null,
      skipped: Boolean(match[1]) || fileSkipsDescribe,
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
});
