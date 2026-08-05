import { parseCentavos, type ParseCentavosResult } from "schemas/src/money.ts";

import { centavosToEditorString, formatCentavos } from "../catalog/helpers.ts";

export type DeltaOutput =
  | { kind: "absolute"; amountCentavos: number }
  | { kind: "multiplier"; perMille: number };

export type ModifierOutput = {
  id: string;
  tenantId: string;
  groupId: string;
  name: string;
  delta: DeltaOutput;
  sortOrder: number;
  archivedAt: Date | null;
  createdAt: Date;
};

export type ModifierGroupOutput = {
  id: string;
  tenantId: string;
  name: string;
  selectionRule: "required-one" | "optional-one" | "many";
  maximum: number | null;
  defaultModifierId: string | null;
  sortOrder: number;
  archivedAt: Date | null;
  createdAt: Date;
  linkedToCount: number;
  modifiers: ModifierOutput[];
};

export const SELECTION_RULE_LABEL: Record<ModifierGroupOutput["selectionRule"], string> = {
  "required-one": "Required one",
  "optional-one": "Optional one",
  many: "Many",
};

export function formatDelta(delta: DeltaOutput): string {
  if (delta.kind === "absolute") {
    // formatCentavos already includes ₱
    const formatted = formatCentavos(delta.amountCentavos);
    return delta.amountCentavos >= 0 ? `+${formatted}` : formatted;
  }
  // per-mille → display rate with up to 3 decimals, no float arithmetic beyond int ops
  const whole = Math.trunc(delta.perMille / 1000);
  const frac = delta.perMille % 1000;
  if (frac === 0) return `×${whole}`;
  const fracStr = frac.toString().padStart(3, "0").replace(/0+$/, "");
  return `×${whole}.${fracStr}`;
}

export function perMilleToEditorString(perMille: number): string {
  const whole = Math.trunc(perMille / 1000);
  const frac = perMille % 1000;
  if (frac === 0) return String(whole);
  return `${whole}.${frac.toString().padStart(3, "0").replace(/0+$/, "")}`;
}

export function absoluteToEditorString(amountCentavos: number): string {
  return centavosToEditorString(amountCentavos);
}

/** Parse absolute peso input (no type=number). */
export function parseAbsoluteDeltaInput(raw: string): ParseCentavosResult {
  const stripped = raw
    .trim()
    .replace(/^[+]/u, "")
    .replace(/^₱\s*/u, "")
    .replace(/,/g, "");
  return parseCentavos(stripped);
}

/**
 * Parse multiplier rate string into per-mille. >3 fractional digits rejected.
 * Integer-only; no float.
 */
export function parseMultiplierRateInput(
  raw: string,
): { ok: true; perMille: number } | { ok: false } {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(raw.trim());
  if (!match) return { ok: false };
  const [, whole, fraction = ""] = match;
  if (fraction.length > 3) return { ok: false };
  const padded = fraction.padEnd(3, "0");
  const perMille = Number(`${whole}${padded}`);
  if (!Number.isSafeInteger(perMille) || perMille < 1 || perMille > 10_000) return { ok: false };
  return { ok: true, perMille };
}

export { formatCentavos };
