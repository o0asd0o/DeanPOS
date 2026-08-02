import { describe, expect, it } from "vite-plus/test";

import {
  normalizePassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordSchema,
  signInPasswordSchema,
} from "../src/password.ts";

describe("normalizePassword", () => {
  it("trims leading and trailing whitespace but keeps interior spaces", () => {
    expect(normalizePassword("  two eggs and toast  ")).toBe("two eggs and toast");
  });

  it("normalises to NFC so a decomposed and a composed form of the same text match", () => {
    const decomposed = "café terrace, doorway"; // e + combining acute
    const composed = "café terrace, doorway"; // precomposed é
    expect(normalizePassword(decomposed)).toBe(normalizePassword(composed));
  });
});

describe("passwordSchema", () => {
  it("accepts exactly the minimum length, in code points", () => {
    const fifteen = "a".repeat(PASSWORD_MIN_LENGTH);
    expect(passwordSchema.parse(fifteen)).toBe(fifteen);
  });

  it("refuses a password shorter than the minimum with the named message", () => {
    const result = passwordSchema.safeParse("short but ok?");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    );
  });

  it("refuses a password longer than the maximum with the named message", () => {
    const result = passwordSchema.safeParse("a".repeat(PASSWORD_MAX_LENGTH + 1));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`,
    );
  });

  it("counts code points, not UTF-16 units — a string of emoji each 2 units long", () => {
    // Each 😀 is one code point but two UTF-16 units; `.length` would see 30.
    const fifteenEmoji = "\u{1F600}".repeat(PASSWORD_MIN_LENGTH);
    expect(fifteenEmoji).toHaveLength(PASSWORD_MIN_LENGTH * 2);
    expect(passwordSchema.safeParse(fifteenEmoji).success).toBe(true);
  });

  it("rejects a password that only clears the minimum before trimming", () => {
    const paddedShort = ` ${"a".repeat(PASSWORD_MIN_LENGTH - 1)} `;
    expect(passwordSchema.safeParse(paddedShort).success).toBe(false);
  });
});

describe("signInPasswordSchema", () => {
  it("never enforces the minimum — a short password parses", () => {
    expect(signInPasswordSchema.parse("short")).toBe("short");
  });

  it("still refuses an empty password", () => {
    expect(signInPasswordSchema.safeParse("").success).toBe(false);
  });

  it("bounds the request at the maximum", () => {
    expect(signInPasswordSchema.safeParse("a".repeat(PASSWORD_MAX_LENGTH + 1)).success).toBe(false);
  });

  it("normalises the same way as the set-password schema, for the same input", () => {
    const raw = "  café terrace  ";
    expect(signInPasswordSchema.parse(raw)).toBe(normalizePassword(raw));
  });
});
