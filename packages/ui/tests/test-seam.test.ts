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

describe("assertNoRawDesignValues — raw values inside className", () => {
  it.each([
    ["an arbitrary property", `<div className="[color:red]" />`],
    ["an arbitrary property with a value that has a unit", `<div className="[padding:13px]" />`],
    ["a prefixed arbitrary value", `<div className="p-[13px]" />`],
    ["a six-digit hex literal", `<div className="text-[#35CCA6]" />`],
    ["a three-digit hex literal", `<div className="text-[#fff]" />`],
    ["an inline style", `<div style={{ padding: 13 }} />`],
    [
      "an arbitrary property with a nested bracket",
      `<div className="[grid-template-columns:[a]_1fr_[b]_2fr]" />`,
    ],
    ["a raw value inside a cn() string argument", `<div className={cn("p-4", "p-[13px]")} />`],
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
    ["ordinary token classes", `<div className="bg-status-success-tone p-4 rounded-md" />`],
    ["a pseudo-class variant", `<div className="[&:hover]:underline" />`],
    [
      "a supports variant with an inner colon",
      `<div className="[@supports(display:grid)]:grid" />`,
    ],
    [
      "a variant with a nested attribute selector containing a colon",
      `<div className='[&[data-state="open:now"]]:block' />`,
    ],
    [
      "the shipped shadcn descendant-selector variant",
      `<div className="[&_svg:not([class*='size-'])]:size-4" />`,
    ],
    ["tap-target as a plain literal", `<div className="tap-target" />`],
  ])("passes on %s", (_label, line) => {
    write(line);
    expect(() => assertNoRawDesignValues(dir)).not.toThrow();
  });

  it("suppresses a violation with a valid design-exempt comment above it", () => {
    write(
      `// design-exempt: brand mark colour is fixed by the client's logo\n<div className="text-[#35CCA6]" />`,
    );
    expect(() => assertNoRawDesignValues(dir)).not.toThrow();
  });

  it("does not suppress a design-exempt reason under four words", () => {
    write(`// design-exempt: brand mark colour\n<div className="text-[#35CCA6]" />`);
    expect(() => assertNoRawDesignValues(dir)).toThrow();
  });

  it("does not suppress a design-exempt placed as a trailing comment", () => {
    write(`<div className="text-[#35CCA6]" /> // design-exempt: brand mark colour is fixed here`);
    expect(() => assertNoRawDesignValues(dir)).toThrow();
  });

  it("does not suppress a different marker", () => {
    write(
      `// eslint-disable-next-line: brand mark colour is fixed by the client's logo\n<div className="text-[#35CCA6]" />`,
    );
    expect(() => assertNoRawDesignValues(dir)).toThrow();
  });
});

describe("assertNoRawDesignValues — code the narrowed scan structurally cannot reach", () => {
  it("does not flag a raw arbitrary property sitting in an array literal, outside any className", () => {
    write(`const classes = ["[color:red]"];`);
    expect(() => assertNoRawDesignValues(dir)).not.toThrow();
  });

  it("does not flag a labelled tuple type", () => {
    write(`type Result = [ok: string] | [error: Error];`);
    expect(() => assertNoRawDesignValues(dir)).not.toThrow();
  });

  it("still rejects that same array once it is used as a className value (assembly rule, not the raw-value rule)", () => {
    write(`const classes = ["[&:hover]:underline"];\n<div className={classes} />;`);
    expect(() => assertNoRawDesignValues(dir)).toThrow(/assembled outside the attribute/);
  });
});

describe("assertNoRawDesignValues — className must not be assembled elsewhere", () => {
  it.each([
    ["a bare identifier", `<div className={styles} />`],
    ["a template literal", `<div className={\`p-4 \${x}\`} />`],
    [
      "an ad-hoc lookup map",
      `const toneByStatus: Record<string, string> = { open: "bg-status-info-tint" };\n<div className={toneByStatus[status]} />`,
    ],
    [
      "an arbitrary property array hoisted into a variable",
      `const classes = ["[&:hover]:underline"];\n<div className={classes} />`,
    ],
  ])("rejects %s", (_label, line) => {
    write(line);
    expect(() => assertNoRawDesignValues(dir)).toThrow(/assembled outside the attribute/);
  });

  it.each([
    ["a plain string literal", `<div className="tap-target" />`],
    [
      "cn() with literals, a condition, and the className prop",
      `<div className={cn("p-4", condition && "bg-muted", className)} />`,
    ],
    [
      "cn() with a cva variants call",
      `<div className={cn(badgeVariants({ variant }), asChild && "tap-target", className)} />`,
    ],
    [
      "cn() with a ternary whose branches are both string literals",
      `<div className={cn(a ? "left-0" : "right-0")} />`,
    ],
  ])("accepts %s", (_label, line) => {
    write(line);
    expect(() => assertNoRawDesignValues(dir)).not.toThrow();
  });

  it("rejects a ternary whose branch is not a literal", () => {
    write(`<div className={cn(a ? styles : "right-0")} />`);
    expect(() => assertNoRawDesignValues(dir)).toThrow(/assembled outside the attribute/);
  });
});
