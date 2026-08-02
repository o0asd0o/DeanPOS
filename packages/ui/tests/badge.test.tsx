// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { Badge } from "../src/index.ts";

afterEach(cleanup);

describe("Badge asChild", () => {
  it("renders a single child through Slot for the default variant", () => {
    const { container } = render(
      <Badge asChild>
        <a href="/orders">Orders</a>
      </Badge>,
    );

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.textContent).toBe("Orders");
  });

  it("renders the child alongside the status dot for a status variant", () => {
    const { container } = render(
      <Badge asChild variant="success">
        <a href="/orders/1">Completed</a>
      </Badge>,
    );

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.textContent).toBe("Completed");
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
