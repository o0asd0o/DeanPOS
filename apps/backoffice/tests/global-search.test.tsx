import { randomUUID } from "node:crypto";

import { fireEvent, renderRoute, screen, waitFor } from "api/src/test-seam-react.tsx";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

// The header's palette goes to screens, not to data — there is no search
// endpoint (record 048's removal).
const tenantId = randomUUID();
const seededEmail = "search.probe@sign-in.test";

describe("the header's global search", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it("greets the signed-in User and opens on Cmd/Ctrl+K", async () => {
    const { db } = renderRoute({ router, tenantId, email: seededEmail });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText(/👋 Hi Search/)).toBeTruthy());

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await waitFor(() => expect(screen.getByLabelText("Search screens")).toBeTruthy());
  });

  it("filters the screens, marks the hit, and Enter takes the top match", async () => {
    const { db } = renderRoute({ router, tenantId, email: seededEmail });
    cleanup = () => db.destroy();

    fireEvent.click(await waitFor(() => screen.getByRole("button", { name: /Search/ })));
    const input = await waitFor(() => screen.getByLabelText("Search screens"));

    fireEvent.change(input, { target: { value: "employ" } });
    const match = await waitFor(() => screen.getByRole("option", { name: /Employees/ }));
    expect(screen.queryByRole("option", { name: /Refunds/ })).toBeNull();
    // The typed run is marked inside the label, not merely implied by the row
    // surviving the filter.
    expect(match.querySelector("mark")?.textContent).toBe("Employ");

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(window.location.pathname).toBe("/employees"));
  });

  it("moves the selection with the arrow keys, wrapping at both ends", async () => {
    const { db } = renderRoute({ router, tenantId, email: seededEmail });
    cleanup = () => db.destroy();

    fireEvent.click(await waitFor(() => screen.getByRole("button", { name: /Search/ })));
    const input = await waitFor(() => screen.getByLabelText("Search screens"));

    const selected = () => screen.getByRole("option", { selected: true }).textContent;
    // Nothing is nominated until the User asks for it — the bare list of every
    // screen has no reason to point at its first entry.
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(1));
    expect(screen.queryAllByRole("option", { selected: true })).toHaveLength(0);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => expect(selected()).toContain("Summary"));
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => expect(selected()).toContain("Orders"));

    // Up from the first entry wraps to the last, so the list has no dead end.
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await waitFor(() => expect(selected()).toContain("Quarantine"));

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(window.location.pathname).toBe("/quarantine"));
  });
});
