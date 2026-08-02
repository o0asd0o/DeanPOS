import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf-8");

const themeCss = read("../src/theme.css");

// A field turns record 014's outline off, so its replacement has to exist and
// stay attached. Either half missing is a control with no focus indicator.
describe("the field focus indicator", () => {
  it("replaces the outline with a border colour and a glow", () => {
    const utility = themeCss.match(/@utility field-focus \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(utility).toContain("outline: none");
    expect(utility).toContain("border-color: var(--color-ring)");
    expect(utility).toMatch(/box-shadow:\s*0 0 0 var\(--focus-glow-width\)/);
    expect(themeCss).toMatch(/--focus-glow-width:\s*\d/);
  });

  it("is carried by every field that opts out of the outline", () => {
    expect(read("../src/components/input.tsx")).toContain("field-focus");
    expect(read("../src/components/select.tsx")).toContain("field-focus");
  });
});
