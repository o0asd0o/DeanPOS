import { assertNoRawDesignValues } from "ui/test-seam";
import { describe, expect, it } from "vite-plus/test";

describe("styling standard", () => {
  it("uses no raw design values under src/", () => {
    expect(() => assertNoRawDesignValues("src")).not.toThrow();
  });
});
