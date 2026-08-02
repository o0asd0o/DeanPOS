import { describe, expect, it } from "vite-plus/test";

import { hashPassword, verifyPassword } from "./password.ts";

// Tested directly, not through the seam (issue 02 acceptance criteria) — a
// pure function over Bun's argon2id primitive.
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

  it("produces an argon2id hash", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).toMatch(/^\$argon2id\$/);
  });
});
