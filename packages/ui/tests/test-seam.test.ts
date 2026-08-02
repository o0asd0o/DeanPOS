import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { assertNoRawDesignValues } from "../src/test-seam.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "design-values-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(contents: string): void {
  writeFileSync(join(dir, "Component.tsx"), contents);
}

describe("assertNoRawDesignValues", () => {
  it.each([
    ["an arbitrary property", `<div className="[color:red]" />`],
    ["an arbitrary property with a value that has a unit", `<div className="[padding:13px]" />`],
    ["a prefixed arbitrary value", `<div className="p-[13px]" />`],
    ["a six-digit hex literal", `const c = "#35CCA6";`],
    ["a three-digit hex literal", `const c = "#fff";`],
    ["an inline style", `<div style={{ padding: 13 }} />`],
  ])("fails on %s", (_label, line) => {
    write(line);
    expect(() => assertNoRawDesignValues(dir)).toThrow();
  });

  it.each([
    ["an arbitrary variant", `<div className="[&_svg]:size-4" />`],
    ["an arbitrary attribute selector", `<div className="[data-state=open]:block" />`],
    ["an arbitrary selector without a value", `<div className="[aria-invalid]:border-red" />`],
    [
      "an arbitrary property inside a variant, colon outside the brackets",
      `<div className="supports-[display:grid]:grid" />`,
    ],
    ["array indexing", `const first = arr[0];`],
    ["ordinary token classes", `<div className="bg-status-success-tone p-4 rounded-md" />`],
  ])("passes on %s", (_label, line) => {
    write(line);
    expect(() => assertNoRawDesignValues(dir)).not.toThrow();
  });

  it("suppresses a violation with a valid design-exempt comment above it", () => {
    write(
      `// design-exempt: brand mark colour is fixed by the client's logo\nconst c = "#35CCA6";`,
    );
    expect(() => assertNoRawDesignValues(dir)).not.toThrow();
  });

  it("does not suppress a design-exempt reason under four words", () => {
    write(`// design-exempt: brand colour\nconst c = "#35CCA6";`);
    expect(() => assertNoRawDesignValues(dir)).toThrow();
  });

  it("does not suppress a design-exempt placed as a trailing comment", () => {
    write(`const c = "#35CCA6"; // design-exempt: brand mark colour is fixed by the client's logo`);
    expect(() => assertNoRawDesignValues(dir)).toThrow();
  });

  it("does not suppress a different marker", () => {
    write(
      `// eslint-disable-next-line: brand mark colour is fixed by the client's logo\nconst c = "#35CCA6";`,
    );
    expect(() => assertNoRawDesignValues(dir)).toThrow();
  });
});
