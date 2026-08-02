import { randomUUID } from "node:crypto";

import { fireEvent, renderRoute, screen, waitFor, within } from "api/src/test-seam-react.tsx";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { router } from "../src/router.tsx";

const tenantId = randomUUID();

describe("the mobile navigation sheet", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("closes itself after a menu entry is picked", async () => {
    const { db } = renderRoute({ router, tenantId });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByLabelText("Open navigation")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Open navigation"));

    const sheet = await waitFor(() => screen.getByRole("dialog"));
    const orders = within(sheet).getByText("Orders").closest("a")!;
    expect(orders.getAttribute("href")).toBe("/reports/orders");
    fireEvent.click(orders);

    // Still open on the tap itself — the close is deliberately delayed.
    expect(screen.getByRole("dialog")).toBeTruthy();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
  });
});
