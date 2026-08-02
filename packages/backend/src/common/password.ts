import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Password hashing parameters, declared once (issue 02, record 028). PIN
// hashing (issue 10) gets its own parameters in its own file — the two must
// not share a knob.
const PASSWORD_HASH_PARAMS = {
  ln: 17,
  r: 8,
  p: 1,
  keyLength: 32,
  saltLength: 16,
};

// maxmem must exceed 128 * N * r bytes or scryptSync throws (record 028's
// conservative cap: 128 * N * r * 2).
function scryptMaxmem(ln: number, r: number): number {
  return 128 * 2 ** ln * r * 2;
}

function toUnpaddedBase64(buffer: Buffer): string {
  return buffer.toString("base64").replace(/=+$/, "");
}

export async function hashPassword(password: string): Promise<string> {
  const { ln, r, p, keyLength, saltLength } = PASSWORD_HASH_PARAMS;
  const salt = randomBytes(saltLength);
  const hash = scryptSync(Buffer.from(password, "utf8"), salt, keyLength, {
    N: 2 ** ln,
    r,
    p,
    maxmem: scryptMaxmem(ln, r),
  });

  return `$scrypt$ln=${ln},r=${r},p=${p}$${toUnpaddedBase64(salt)}$${toUnpaddedBase64(hash)}`;
}

// A fixed, precomputed hash (never a real password's) — sign-in verifies
// against this when no account matches, for timing parity (issue 03 AC 5).
export const DUMMY_PASSWORD_HASH =
  "$scrypt$ln=17,r=8,p=1$NMqZd4gjS3WWBoA+FjDObw$R6csWajqnn+qt9upBUceIVZpwEMHHKbRDuj8mBxVmJY";

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const match = /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(stored);
  if (!match) return false;

  const [, lnStr, rStr, pStr, saltB64, hashB64] = match;
  const ln = Number(lnStr);
  const r = Number(rStr);
  const p = Number(pStr);
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");

  const actual = scryptSync(Buffer.from(password, "utf8"), salt, expected.length, {
    N: 2 ** ln,
    r,
    p,
    maxmem: scryptMaxmem(ln, r),
  });

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
