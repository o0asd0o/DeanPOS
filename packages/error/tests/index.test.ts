import { describe, expect, it, vi } from "vite-plus/test";

import { toSafeErrorResponse } from "../src/index.ts";

describe("toSafeErrorResponse", () => {
  it("returns a fixed generic message, never the caught error's own message", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = toSafeErrorResponse(
      new Error('password authentication failed for user "deanpos"'),
    );

    expect(response.message).not.toMatch(/password|deanpos/i);
    expect(response).toStrictEqual({ message: "Something went wrong. Please try again." });

    vi.restoreAllMocks();
  });
});
