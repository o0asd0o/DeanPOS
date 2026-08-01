import { describe, expect, it } from "vite-plus/test";

import { Button, cn, Sheet, SheetContent, SheetTrigger } from "../src/index.ts";

describe("packages/ui exports", () => {
  it("exports the button and sheet primitives, and the cn helper", () => {
    expect(typeof Button).toBe("function");
    expect(typeof Sheet).toBe("function");
    expect(typeof SheetTrigger).toBe("function");
    expect(typeof SheetContent).toBe("function");
    expect(typeof cn).toBe("function");
  });

  it("cn merges and dedupes Tailwind class strings", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
