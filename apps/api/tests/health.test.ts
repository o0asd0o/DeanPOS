import { afterAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();

afterAll(async () => {
  await seam.db.destroy();
});

describe("health", () => {
  it("reports liveness and database reachability as two booleans, and discloses nothing else", async () => {
    const response = await seam.app.request("/health");
    const body = await response.json();

    expect(body).toStrictEqual({ live: true, databaseReachable: true });
  });
});
