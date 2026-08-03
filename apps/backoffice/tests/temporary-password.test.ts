import { describe, expect, it } from "vite-plus/test";

import { generateTemporaryPassword } from "@/features/users/helpers.ts";

// Records 051 and 052. Six upper-case symbols, matching the temporary-password
// floor; `schemas` is not a dependency of this app, so the number is asserted
// here rather than imported — the same call this app's `UserOutput` type makes.
describe("generateTemporaryPassword", () => {
  it("is long enough for the policy and free of lookalike characters", () => {
    for (let i = 0; i < 50; i++) {
      const password = generateTemporaryPassword();
      expect(password.length).toBe(6);
      expect(password).toMatch(/^[A-Z2-9]+$/);
      expect(password).not.toMatch(/[IO01]/);
    }
  });

  it("does not repeat itself", () => {
    const seen = new Set(Array.from({ length: 20 }, () => generateTemporaryPassword()));
    expect(seen.size).toBe(20);
  });
});
