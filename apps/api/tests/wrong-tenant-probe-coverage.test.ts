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
const guardFileName = fileURLToPath(import.meta.url).split("/").pop()!;

function collectTestFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return /\.test\.tsx?$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap((entry) => collectTestFiles(join(path, entry)));
}
const testFiles = collectTestFiles(testsDir).filter((file) => !file.endsWith(guardFileName));

const TAG = /wrong-tenant probe \[([\w.]+)\]/;
const IT_OPEN = /\b(?:it|test)(\.skip|\.todo)?\s*\(/g;
const NAME_LITERAL =
  /^\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/;

type Probe = {
  file: string;
  name: string;
  tag: string | null;
  skipped: boolean;
  body: string;
};

// Walks paren depth from an `it(`/`test(` opening paren, skipping string and
// template literals — the technique pin-no-logging-grep.test.ts hand-rolls
// for the same reason: a single-line regex can't see a multi-line call.
function extractProbes(contents: string, file: string): Probe[] {
  const probes: Probe[] = [];
  const fileSkipsDescribe = /\bdescribe(\.skip)\s*\(/.test(contents);
  for (const match of contents.matchAll(IT_OPEN)) {
    const openIndex = match.index + match[0].length - 1;
    const nameMatch = contents.slice(openIndex + 1).match(NAME_LITERAL);
    if (!nameMatch) continue;
    const name = nameMatch[1] ?? nameMatch[2] ?? nameMatch[3] ?? "";

    let depth = 0;
    let quote: string | null = null;
    let end = -1;
    for (let i = openIndex; i < contents.length; i++) {
      const char = contents[i];
      if (quote) {
        if (char === "\\") i++;
        else if (char === quote) quote = null;
        continue;
      }
      // A `//` line comment can carry an apostrophe (e.g. "B's own path")
      // that would otherwise be mistaken for an opening quote — skip to
      // the newline instead of tracking depth through it.
      if (char === "/" && contents[i + 1] === "/") {
        const nextNewline = contents.indexOf("\n", i);
        i = nextNewline === -1 ? contents.length : nextNewline;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") quote = char;
      else if (char === "(") depth++;
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
    expect(missing, missing.map((path) =>
      `wrong-tenant probe coverage: no probe for "${path}". Add a test named: wrong-tenant probe [${path}]: <what it proves>`,
    ).join("\n")).toStrictEqual([]);
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
      .map(
        (probe) =>
          `wrong-tenant probe coverage: the probe tagged [${probe.tag}] is skipped.`,
      );
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
});
