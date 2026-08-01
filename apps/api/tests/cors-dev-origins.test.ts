import { afterAll, describe, expect, it } from "vite-plus/test";

import { ENV_KEYS } from "../src/env.ts";
import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam({ devOrigins: ["http://localhost:6003"] });
const appDomain = process.env[ENV_KEYS.appDomain]!;

afterAll(async () => {
  await seam.db.destroy();
});

describe("CORS devOrigins", () => {
  it("echoes back a development origin passed to createApp, additively with production", async () => {
    const devOrigin = "http://localhost:6003";
    const devResponse = await seam.app.request("/health", { headers: { Origin: devOrigin } });

    expect(devResponse.headers.get("Access-Control-Allow-Origin")).toBe(devOrigin);

    const posOrigin = `https://pos.${appDomain}`;
    const posResponse = await seam.app.request("/health", { headers: { Origin: posOrigin } });

    expect(posResponse.headers.get("Access-Control-Allow-Origin")).toBe(posOrigin);
  });

  it("still sends no header for an origin not on the list", async () => {
    const response = await seam.app.request("/health", {
      headers: { Origin: "https://attacker.example.com" },
    });

    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });
});
