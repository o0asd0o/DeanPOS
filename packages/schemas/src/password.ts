import { z } from "zod";

// SP 800-63B-4 §3.1.1.2, item 1: 15 is the single-factor minimum, not the
// multi-factor allowance of 8 — this product has no second factor. See
// .scratch/decisions/032-the-password-policy.md.
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

// Trim then NFC (SP 800-63B-4 §3.1.1.2). Called from both the set-password
// and sign-in paths — never duplicated, or a normalised-at-set /
// not-normalised-at-verify divergence locks out every non-ASCII user.
export function normalizePassword(password: string): string {
  return password.trim().normalize("NFC");
}

// Code points, never `.length` (which counts UTF-16 units) — SP 800-63B-4
// §3.1.1.2 item 4.
function codePointLength(password: string): number {
  return Array.from(password).length;
}

// For setting or provisioning a password: the full policy. Never applied at
// sign-in — that path verifies bytes and gains no strength check.
export const passwordSchema = z
  .string()
  .transform(normalizePassword)
  .superRefine((value, ctx) => {
    const length = codePointLength(value);
    if (length < PASSWORD_MIN_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      });
    } else if (length > PASSWORD_MAX_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`,
      });
    }
  });

// For sign-in: normalises so the bytes match what was hashed, and bounds
// the request — but never enforces the minimum. A policy check here would
// reject an existing account's password before letting them in to change it.
export const signInPasswordSchema = z
  .string()
  .min(1)
  .transform(normalizePassword)
  .refine((value) => codePointLength(value) <= PASSWORD_MAX_LENGTH, {
    message: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`,
  });
