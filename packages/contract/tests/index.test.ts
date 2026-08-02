import { describe, expect, it } from "vite-plus/test";

import { contract, pingOutputSchema } from "../src/index.ts";

describe("contract", () => {
  it("declares ping's output shape", () => {
    const parsed = pingOutputSchema.parse({ id: 1, message: "pong", createdAt: new Date() });

    expect(parsed.message).toBe("pong");
  });

  it("declares exactly ping and store, ready for implement()", () => {
    expect(Object.keys(contract)).toStrictEqual(["ping", "store"]);
  });
});
