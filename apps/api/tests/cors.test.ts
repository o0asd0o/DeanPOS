import { afterAll, describe, expect, it } from "vite-plus/test";

import { ENV_KEYS } from "../src/env.ts";
import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();
const appDomain = process.env[ENV_KEYS.appDomain]!;

afterAll(async () => {
  await seam.db.destroy();
});

describe("CORS", () => {
  it("sends no Access-Control-Allow-Origin header for a non-allowlisted origin", async () => {
    const response = await seam.app.request("/health", {
      headers: { Origin: `https://evil.${appDomain}` },
    });

    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("echoes exactly the pos origin back to the pos origin", async () => {
    const posOrigin = `https://pos.${appDomain}`;
    const response = await seam.app.request("/health", { headers: { Origin: posOrigin } });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(posOrigin);
  });

  it("echoes exactly the admin origin back to the admin origin", async () => {
    const adminOrigin = `https://admin.${appDomain}`;
    const response = await seam.app.request("/health", { headers: { Origin: adminOrigin } });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(adminOrigin);
  });

  it("never returns a wildcard", async () => {
    const posOrigin = `https://pos.${appDomain}`;
    const response = await seam.app.request("/health", { headers: { Origin: posOrigin } });

    expect(response.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
  });

  it("never returns an arbitrary origin echoed back from the request", async () => {
    const attackerOrigin = "https://attacker.example.com";
    const response = await seam.app.request("/health", { headers: { Origin: attackerOrigin } });

    expect(response.headers.get("Access-Control-Allow-Origin")).not.toBe(attackerOrigin);
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  // Without this, the browser discards the session Set-Cookie on the
  // cross-subdomain request regardless of the cookie's own attributes.
  it("sends Access-Control-Allow-Credentials: true for an allowlisted origin", async () => {
    const adminOrigin = `https://admin.${appDomain}`;
    const response = await seam.app.request("/health", { headers: { Origin: adminOrigin } });

    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });
});
