// PIN hashing (issue 10, record 057). PBKDF2-HMAC-SHA-256 via
// `globalThis.crypto.subtle` — the one KDF the browser, the API server, and
// the test runner can all compute. No `node:` import, ever: this file is
// the only place both the browser and the server can reach, and it must
// stay importable from a browser (record 057 Q1, "what must not be built").
export const PIN_HASH_PARAMS = {
  iterations: 600_000,
  hash: "SHA-256",
  keyLength: 32,
  saltLength: 16,
} as const;

const PIN_PATTERN = /^\d{4,6}$/;
const STORED_PATTERN = /^\$pbkdf2-sha256\$i=(\d+)\$([^$]+)\$([^$]+)$/;

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

// The one derivation call, shared by hash and verify (RFC 7914 §11's shape).
async function deriveBits(
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
// PIN_HASH_PARAMS.iterations — so raising the constant later needs no
// migration (028's rule, inherited by 057). Anything not `pbkdf2-sha256`
// returns false, the branch point for a future algorithm.
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const match = STORED_PATTERN.exec(stored);
  if (!match) return false;

  const [, iterationsStr, saltB64, hashB64] = match;
  const iterations = Number(iterationsStr);
  const salt = fromUnpaddedBase64(saltB64!);
  const expected = fromUnpaddedBase64(hashB64!);

  const actual = await deriveBits(pin, salt, iterations, expected.length);
  if (actual.length !== expected.length) return false;

  // Constant-time compare over the two byte arrays — `timingSafeEqual` is
  // `node:crypto` and unreachable in a browser (record 057 Q1).
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}
