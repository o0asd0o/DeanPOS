import { randomBytes } from "node:crypto";

// Record 056 Q4: 2-4 symbols, admin-typed, excludes I/L/O — kept 0/1 so
// "C1" stays writable. Mirrors the DB CHECK; this is the advisory-message
// half, never the hard guarantee (that is Device's own unique index).
export const DEVICE_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ0-9]{2,4}$/;

export const normalizeDeviceCode = (raw: string): string => raw.trim().toUpperCase();

export const isValidDeviceCode = (code: string): boolean => DEVICE_CODE_PATTERN.test(code);

// Record 056 smaller call 3: Crockford's 32-symbol alphabet, whole 5-bit
// groups from randomBytes(5) — uniform by construction, no rejection
// sampling. Displayed grouped by the caller; stored ungrouped.
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const generateEnrolmentSecret = (): string => {
  const bytes = randomBytes(5);
  // 5 bytes = 40 bits = eight 5-bit groups.
  const bits = bytes.reduce((acc, byte) => acc + byte.toString(2).padStart(8, "0"), "");
  let secret = "";
  for (let i = 0; i < 8; i++) {
    const group = bits.slice(i * 5, i * 5 + 5);
    secret += CROCKFORD_ALPHABET[parseInt(group, 2)];
  }
  return secret;
};

// The terminal's input is normalised before send (record 056 Q5): stripped
// of whitespace/dashes, upper-cased, and I/L→1, O→0 per Crockford's own
// decoding rule — never a distinguishable error for a mistyped confusable.
export const normalizeEnrolmentSecret = (raw: string): string =>
  raw.toUpperCase().replace(/[\s-]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
