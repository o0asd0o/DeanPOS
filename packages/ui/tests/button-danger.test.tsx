// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { Button } from "../src/index.ts";

afterEach(cleanup);

describe("Button danger", () => {
  it("fills solid on the default variant", () => {
    const { container } = render(<Button danger>Deactivate</Button>);

    expect(container.querySelector("button")?.className).toContain("bg-destructive");
  });

  it("tints on the outline variant", () => {
    const { container } = render(
      <Button variant="outline" danger>
        Deactivate
      </Button>,
    );

    const className = container.querySelector("button")?.className ?? "";
    expect(className).toContain("bg-status-danger-tint");
    expect(className).toContain("text-status-danger-tone");
  });

  it("leaves a button without the prop untouched", () => {
    const { container } = render(<Button>Save</Button>);

    expect(container.querySelector("button")?.className).toContain("bg-primary");
    expect(container.querySelector("button")?.className).not.toContain("bg-destructive");
  });
});
