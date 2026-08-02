import { randomUUID } from "node:crypto";

import { fireEvent, renderRoute, screen, waitFor } from "api/src/test-seam-react.tsx";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { router } from "../src/router.tsx";

// Issue 03 round 2: auth.signOut existed and was tested server-side, but
// nothing in this app called it.
const tenantId = randomUUID();

describe("the shell's sign-out control", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("signs out and returns to the sign-in screen", async () => {
    const { container, db } = renderRoute({ router, tenantId });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "DeanPOS back-office" })).toBeTruthy(),
    );
    expect(container.querySelectorAll("header")).toHaveLength(0);
  });
});
