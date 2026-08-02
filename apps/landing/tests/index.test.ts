import { describe, expect, it } from "vite-plus/test";

import { workspaceName } from "@/index.ts";

describe("workspace placeholder", () => {
  it("exports its own name", () => {
    expect(workspaceName).toBe("landing");
  });
});
