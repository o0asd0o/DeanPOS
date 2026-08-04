import { randomUUID } from "node:crypto";

import {
  expectNoAxeViolations,
  fireEvent,
  renderRoute,
  screen,
  waitFor,
} from "api/src/test-seam-react.tsx";
import { createTestSeam } from "api/src/test-seam.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

// Record 030: the sign-in screen's states, copy and structure. Real
// credentials, driven through the real HTTP surface, not test-seam shortcuts.
const authSeam = createTestSeam();
const email = `sign-in-screen-${randomUUID()}@sign-in.test`;
const password = "correct horse battery staple";

let admin: { tenantId: string; userId: string };

beforeAll(async () => {
  const provisioned = await authSeam.actors
    .asPlatformAdmin(randomUUID())
    .client.platformAdmin.provisionTenant({
      tenantName: "Sign-in Screen Tenant",
      adminEmail: email,
      adminPassword: password,
    });
  if (!provisioned) throw new Error("provisionTenant refused");
  admin = provisioned;
});

afterAll(async () => {
  await authSeam.db.destroy();
});

// happy-dom strips `Set-Cookie` from a Response, so the browser's cookie jar
// is stood in for here: requests answer as signed out until the sign-in
// succeeds, and as that admin afterwards.
function sessionCarryingFetch(): typeof fetch {
  const signedOut = authSeam.actors.asUnauthenticated();
  const signedIn = authSeam.actors.asTenant(admin.tenantId, {
    userId: admin.userId,
    email,
    role: "admin",
    mustChangePassword: true,
  });
  let current = signedOut;

  return (async (request: Request, init?: RequestInit) => {
    const isSignIn = request.url.endsWith("/auth/signIn");
    const response = await (isSignIn ? signedOut : current).app.request(request, init);
    if (isSignIn && response.status === 200) current = signedIn;
    return response;
  }) as unknown as typeof fetch;
}

describe("the sign-in screen", () => {
  it("renders the mock's structure and order, with no sidebar and no header", async () => {
    const { container, db } = renderRoute({ router });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "DeanPOS back-office" })).toBeTruthy(),
    );

    expect(container.querySelectorAll("header")).toHaveLength(0);
    expect(container.querySelectorAll("nav")).toHaveLength(0);

    const email = screen.getByLabelText("Email") as HTMLInputElement;
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(email.type).toBe("email");
    expect(email.required).toBe(true);
    expect(email.getAttribute("autocomplete")).toBe("username");
    expect(password.type).toBe("password");
    expect(password.required).toBe(true);
    expect(password.getAttribute("autocomplete")).toBe("current-password");

    const button = screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("false");

    // No error block until there is an error — record 009's rule.
    expect(screen.queryByRole("alert")).toBeNull();

    await expectNoAxeViolations(container);
    await db.destroy();
  });

  it("a wrong password shows the one sentence, form-level, and never marks a field invalid", async () => {
    const { container, db } = renderRoute({ router });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "DeanPOS back-office" })).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toBe("Email or password is incorrect");

    const emailField = screen.getByLabelText("Email") as HTMLInputElement;
    const passwordField = screen.getByLabelText("Password") as HTMLInputElement;
    expect(emailField.getAttribute("aria-invalid")).not.toBe("true");
    expect(passwordField.getAttribute("aria-invalid")).not.toBe("true");

    await expectNoAxeViolations(container);
    await db.destroy();
  });

  it("an unknown email shows the exact same sentence", async () => {
    const { db } = renderRoute({ router });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "DeanPOS back-office" })).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: `nobody-${randomUUID()}@sign-in.test` },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "irrelevant" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toBe("Email or password is incorrect");

    await db.destroy();
  });

  // happy-dom refuses scripts a cookie jar, so the round trip below carries
  // the session header itself against the shared seam's app.
  it("a correct sign-in never shows the failure sentence", async () => {
    const { db } = renderRoute({ router });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "DeanPOS back-office" })).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Signing in…" })).toBeTruthy());
    await waitFor(() => expect(screen.queryByRole("button", { name: "Signing in…" })).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();

    await db.destroy();
  });

  // Arriving at `/` first is what makes this the real path: the guard's own
  // `auth.me` fetch caches an unauthenticated answer, and the sign-in has to
  // invalidate it or every guard after it reads the pre-sign-in session.
  it("a correct sign-in leaves the login screen when the guard cached the signed-out answer", async () => {
    const { db } = renderRoute({ router, initialLocation: "/", fetch: sessionCarryingFetch() });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "DeanPOS back-office" })).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    // A provisioned admin still owes a password change, so the gate hands
    // them to `/set-password` rather than to the shell.
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Set a new password" })).toBeTruthy(),
    );

    await db.destroy();
  });
});
