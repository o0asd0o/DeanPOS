// PIN hashing (issue 10, record 057). PBKDF2-HMAC-SHA-256 via
// `globalThis.crypto.subtle`, the one KDF browser, server and test runner
// share. No `node:` import — this file must stay importable from a browser.
export const PIN_HASH_PARAMS = {
  iterations: 600_000,
  hash: "SHA-256",
  keyLength: 32,
  saltLength: 16,
} as const;

const PIN_PATTERN = /^\d{4,6}$/;
const STORED_PATTERN = /^\$pbkdf2-sha256\$i=(\d+)\$([^$]+)\$([^$]+)$/;

// A ceiling on a stored hash's iteration count, well above
// PIN_HASH_PARAMS.iterations so raising that constant needs no migration.
const MAX_VERIFY_ITERATIONS = 10_000_000;

const textEncoder = new TextEncoder();

function toUnpaddedBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=+$/, "");
}

function fromUnpaddedBase64(value: string): Uint8Array {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// `Algorithm` typed loosely so this file names no `dom`/`webcrypto`-only
// type — `globalThis.crypto.subtle` is available on every runtime this
// module runs on regardless (record 057 Q1).
type Pbkdf2Algorithm = { name: "PBKDF2"; salt: Uint8Array; iterations: number; hash: "SHA-256" };

// The one derivation call, shared by hash and verify, and exported so the
// RFC 7914 §11 vectors exercise this exact function rather than a
// reimplementation (record 057 Q2).
export async function deriveBits(
  pin: string,
  salt: Uint8Array,
  iterations: number,
  keyLengthBytes: number,
): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const algorithm: Pbkdf2Algorithm = { name: "PBKDF2", salt, iterations, hash: "SHA-256" };
  const bits = await globalThis.crypto.subtle.deriveBits(
    algorithm as unknown as Parameters<typeof globalThis.crypto.subtle.deriveBits>[0],
    key,
    keyLengthBytes * 8,
  );
  return new Uint8Array(bits);
}

// Re-checked here, not only in the zod input schema (record 057 Q2) — a
// PIN is never parsed to a number, and this is the last gate before a hash
// is derived from one.
export async function hashPin(pin: string): Promise<string> {
  if (!PIN_PATTERN.test(pin)) throw new Error("A PIN must be 4 to 6 digits");

  const { iterations, keyLength, saltLength } = PIN_HASH_PARAMS;
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(saltLength));
  const derived = await deriveBits(pin, salt, iterations, keyLength);

  return `$pbkdf2-sha256$i=${iterations}$${toUnpaddedBase64(salt)}$${toUnpaddedBase64(derived)}`;
}

// Verification always uses the iteration count parsed from `stored`, never
// PIN_HASH_PARAMS.iterations, so raising the constant later needs no
// migration (028's rule, inherited by 057).
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const match = STORED_PATTERN.exec(stored);
  if (!match) return false;

  const [, iterationsStr, saltB64, hashB64] = match;
  const iterations = Number(iterationsStr);
  if (!Number.isSafeInteger(iterations) || iterations <= 0 || iterations > MAX_VERIFY_ITERATIONS) {
    return false;
  }

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromUnpaddedBase64(saltB64!);
    expected = fromUnpaddedBase64(hashB64!);
  } catch {
    return false;
  }

  // The derived length is always the fixed 32 bytes, never a length read
  // from `stored` — an attacker-chosen key length must not shrink the
  // comparison or change how long verification takes.
  const keyLength = PIN_HASH_PARAMS.keyLength;
  let actual: Uint8Array;
  try {
    actual = await deriveBits(pin, salt, iterations, keyLength);
  } catch {
    // A malformed roster entry (e.g. a corrupt salt length WebCrypto
    // rejects) must reject this one PIN, not throw and brick unlock.
    return false;
  }

  // A length mismatch accumulates into the result rather than returning
  // early — the loop below always walks the full fixed length, so a
  // one-byte `expected` never admits a wrong PIN by luck.
  let diff = expected.length === keyLength ? 0 : 1;
  for (let i = 0; i < keyLength; i++) diff |= (actual[i] ?? 0) ^ (expected[i] ?? 0);
  return diff === 0;
}
