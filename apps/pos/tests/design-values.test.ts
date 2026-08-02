import { readFileSync } from "node:fs";
import { assertNoRawDesignValues } from "ui/test-seam";
import { describe, expect, it } from "vite-plus/test";

describe("styling standard", () => {
  it("uses no raw design values under src/", () => {
    expect(() => assertNoRawDesignValues("src")).not.toThrow();
  });

  it("sets the touch density on the document root — record 013", () => {
    expect(readFileSync("index.html", "utf8")).toContain('data-density="touch"');
  });
});
