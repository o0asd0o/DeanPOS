import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, waitFor } from "api/src/test-seam-react.tsx";
import { describe, expect, it, vi } from "vite-plus/test";

import { AppShell } from "@/components/AppShell.tsx";

vi.mock("@/components/LockButton.tsx", () => ({ LockButton: () => null }));

function renderShell() {
  const rootRoute = createRootRoute({ component: AppShell });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>Unlock screen</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  return render(<RouterProvider router={router} />);
}

describe("POS shell header", () => {
  it("uses a white bordered default header without changing the dark Sale header", async () => {
    const { container } = renderShell();

    await waitFor(() => expect(container.querySelector("#shell-default-header")).toBeTruthy());

    const header = container.querySelector("header")!;
    const defaultHeader = container.querySelector("#shell-default-header")!;
    const saleHeader = container.querySelector("#shell-sale-header")!;

    expect(header.className).not.toContain("bg-foreground");
    expect(defaultHeader.className).toContain("bg-card");
    expect(defaultHeader.className).toContain("border-b");
    expect(defaultHeader.className).toContain("border-border");
    expect(defaultHeader.className).toContain("text-foreground");
    expect(saleHeader.className).toContain("bg-foreground");
    expect(saleHeader.className).toContain("text-background");
  });
});
