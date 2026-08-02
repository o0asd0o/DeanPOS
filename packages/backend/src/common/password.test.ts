import { scryptSync } from "node:crypto";

import { describe, expect, it } from "vite-plus/test";

import { hashPassword, verifyPassword } from "./password.ts";

// Tested directly, not through the seam (issue 02 acceptance criteria) — a
// pure function over node:crypto's scrypt primitive (record 028).
describe("password hashing", () => {
  it("hashes and verifies a matching password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password against the hash", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("never stores the plaintext password in the hash", async () => {
    const password = "correct horse battery staple";
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
  });

  it("produces a scrypt hash", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).toMatch(/^\$scrypt\$/);
  });
});

// RFC 7914 §12 known-answer vectors, against a raw scryptSync call — proof
// the KDF itself is correct, not just that hash and verify agree with each
// other (a round-trip test passes over a broken KDF just as happily).
describe("scrypt known-answer vectors (RFC 7914 §12)", () => {
  it("matches vector 1: P='', S='', N=16, r=1, p=1", () => {
    const derived = scryptSync("", "", 64, { N: 16, r: 1, p: 1, maxmem: 64 * 1024 * 1024 });

    expect(derived.toString("hex")).toBe(
      "77d6576238657b203b19ca42c18a0497f16b4844e3074ae8dfdffa3fede21442fcd0069ded0948f8326a753a0fc81f17e8d3e0fb2e0d3628cf35e20c38d18906",
    );
  });

  it("matches vector 2: P='password', S='NaCl', N=1024, r=8, p=16", () => {
    const derived = scryptSync("password", "NaCl", 64, {
      N: 1024,
      r: 8,
      p: 16,
      maxmem: 64 * 1024 * 1024,
    });

    expect(derived.toString("hex")).toBe(
      "fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640",
    );
  });
});
