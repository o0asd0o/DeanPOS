import { describe, expect, it } from "vite-plus/test";

import { generateTemporaryPassword } from "@/features/users/helpers.ts";

// Record 051. 20 is well clear of the server's 8-character floor (record 032);
// `schemas` is not a dependency of this app, so the number is asserted here
// rather than imported — the same call this app's `UserOutput` type makes.
describe("generateTemporaryPassword", () => {
  it("is long enough for the policy and free of lookalike characters", () => {
    for (let i = 0; i < 50; i++) {
      const password = generateTemporaryPassword();
      expect(password.length).toBe(20);
      expect(password).toMatch(/^[a-zA-Z0-9]+$/);
      expect(password).not.toMatch(/[lIO01]/);
    }
  });

  it("does not repeat itself", () => {
    const seen = new Set(Array.from({ length: 20 }, () => generateTemporaryPassword()));
    expect(seen.size).toBe(20);
  });
});
