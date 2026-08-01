import { afterAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam({ devOrigins: ["http://localhost:5173"] });

afterAll(async () => {
  await seam.db.destroy();
});

describe("CORS devOrigins", () => {
  it("echoes back a development origin passed to createApp", async () => {
    const devOrigin = "http://localhost:5173";
    const response = await seam.app.request("/health", { headers: { Origin: devOrigin } });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(devOrigin);
  });

  it("still sends no header for an origin not on the list", async () => {
    const response = await seam.app.request("/health", {
      headers: { Origin: "https://attacker.example.com" },
    });

    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });
});
