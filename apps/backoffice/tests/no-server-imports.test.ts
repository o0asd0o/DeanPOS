import { assertNoServerImports } from "api/src/test-seam-react.tsx";
import { describe, expect, it } from "vite-plus/test";

describe("devDependency boundary", () => {
  it("imports no server-only module under src/", () => {
    expect(() => assertNoServerImports("src")).not.toThrow();
  });
});
