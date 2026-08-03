import { createHash, randomBytes } from "node:crypto";

// Record 056 Q2: 256 bits, base64url, hashed with one unsalted SHA-256 and
// compared by indexed equality only — no timingSafeEqual, no KDF. The
// plaintext is returned to the caller exactly once and never logged.
export const generateDeviceToken = (): string => randomBytes(32).toString("base64url");

export const hashDeviceToken = (token: string): string =>
  createHash("sha256").update(Buffer.from(token, "utf8")).digest("hex");
