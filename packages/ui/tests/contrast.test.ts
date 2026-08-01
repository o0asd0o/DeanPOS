import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

// WCAG 2.2 relative luminance and contrast ratio.
// https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
const linear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

const contrastRatio = (hexA: string, hexB: string): number => {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
};

const themeCssPath = fileURLToPath(new URL("../src/theme.css", import.meta.url));
const themeCss = readFileSync(themeCssPath, "utf-8");

const tokens = new Map<string, string>();
for (const match of themeCss.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) {
  tokens.set(match[1], match[2]);
}

const color = (name: string): string => {
  const value = tokens.get(name);
  if (!value) throw new Error(`No --color-${name} token in theme.css`);
  return value;
};

// [foreground, background, threshold, WCAG criterion]
const pairings: [string, string, number, string][] = [
  ["foreground", "background", 4.5, "1.4.3"],
  ["foreground", "card", 4.5, "1.4.3"],
  ["card-foreground", "card", 4.5, "1.4.3"],
  ["muted-foreground", "background", 4.5, "1.4.3"],
  ["muted-foreground", "muted", 4.5, "1.4.3"],
  ["primary-foreground", "primary", 4.5, "1.4.3"],
  ["secondary-foreground", "secondary", 4.5, "1.4.3"],
  ["accent-foreground", "accent", 4.5, "1.4.3"],
  ["destructive-foreground", "destructive", 4.5, "1.4.3"],
  ["border", "background", 3.0, "1.4.11"],
  ["input", "background", 3.0, "1.4.11"],
  ["ring", "background", 3.0, "1.4.11"],
  ["ring", "card", 3.0, "1.4.11"],
  ["ring", "primary", 3.0, "1.4.11"],
];

describe("colour token contrast (WCAG 2.2 AA)", () => {
  it("finds colour tokens in theme.css", () => {
    expect(tokens.size).toBeGreaterThan(0);
  });

  for (const [fg, bg, threshold, criterion] of pairings) {
    it(`${fg} on ${bg} meets ${threshold}:1 (SC ${criterion})`, () => {
      const ratio = contrastRatio(color(fg), color(bg));
      expect(ratio).toBeGreaterThanOrEqual(threshold);
    });
  }

  it("asserts every declared colour token in at least one pairing", () => {
    const testedNames = new Set(pairings.flatMap(([fg, bg]) => [fg, bg]));
    const untested = [...tokens.keys()].filter((name) => !testedNames.has(name));
    expect(untested).toEqual([]);
  });
});
