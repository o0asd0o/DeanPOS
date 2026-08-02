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
  ["ring", "popover", 3.0, "1.4.11"],
  ["ring", "secondary", 3.0, "1.4.11"],
  ["ring", "muted", 3.0, "1.4.11"],
  ["ring", "accent", 3.0, "1.4.11"],
  ["popover-foreground", "popover", 4.5, "1.4.3"],
  ["sidebar-foreground", "sidebar", 4.5, "1.4.3"],
  ["sidebar-primary-foreground", "sidebar-primary", 4.5, "1.4.3"],
  ["sidebar-accent-foreground", "sidebar-accent", 4.5, "1.4.3"],
  ["sidebar-border", "sidebar", 3.0, "1.4.11"],
  ["sidebar-ring", "sidebar", 3.0, "1.4.11"],
  ["ring", "sidebar", 3.0, "1.4.11"],
  ["ring", "sidebar-accent", 3.0, "1.4.11"],
  ["ring", "status-success-tint", 3.0, "1.4.11"],
  ["ring", "status-warning-tint", 3.0, "1.4.11"],
  ["ring", "status-info-tint", 3.0, "1.4.11"],
  ["ring", "status-danger-tint", 3.0, "1.4.11"],
  ["foreground", "status-success-tint", 4.5, "1.4.3"],
  ["foreground", "status-warning-tint", 4.5, "1.4.3"],
  ["foreground", "status-info-tint", 4.5, "1.4.3"],
  ["foreground", "status-danger-tint", 4.5, "1.4.3"],
  ["status-success-tone", "status-success-tint", 3.0, "1.4.11"],
  ["status-warning-tone", "status-warning-tint", 3.0, "1.4.11"],
  ["status-info-tone", "status-info-tint", 3.0, "1.4.11"],
  ["status-danger-tone", "status-danger-tint", 3.0, "1.4.11"],
  ["status-success-tone", "background", 3.0, "1.4.11"],
  ["status-warning-tone", "background", 3.0, "1.4.11"],
  ["status-info-tone", "background", 3.0, "1.4.11"],
  ["status-danger-tone", "background", 3.0, "1.4.11"],
  ["status-success-tone", "card", 3.0, "1.4.11"],
  ["status-warning-tone", "card", 3.0, "1.4.11"],
  ["status-info-tone", "card", 3.0, "1.4.11"],
  ["status-danger-tone", "card", 3.0, "1.4.11"],
];

// The complete `--color-*` set. `.scratch/decisions/013-density-mechanism-and-token-names.md`
// fixes this list; issues 13 and 14 are told to preserve it exactly.
const requiredTokens = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "status-success-tint",
  "status-success-tone",
  "status-warning-tint",
  "status-warning-tone",
  "status-info-tint",
  "status-info-tone",
  "status-danger-tint",
  "status-danger-tone",
];

describe("colour token contrast (WCAG 2.2 AA)", () => {
  it("finds colour tokens in theme.css", () => {
    expect(tokens.size).toBeGreaterThan(0);
  });

  it("declares every token from record 013's token list", () => {
    const missing = requiredTokens.filter((name) => !tokens.has(name));
    expect(missing).toEqual([]);
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

  it("keeps --focus-ring-offset at 1px or more (record 014: at 0 the ring vanishes into primary)", () => {
    const match = themeCss.match(/--focus-ring-offset:\s*(\d+(?:\.\d+)?)px;/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(1);
  });
});
