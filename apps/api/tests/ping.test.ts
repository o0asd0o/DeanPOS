import { afterAll, describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";

const seam = createTestSeam();

afterAll(async () => {
  await seam.db.destroy();
});

describe("ping", () => {
  it("returns the row read from PostgreSQL, through contract → route → handler → query → Kysely", async () => {
    const ping = await seam.client.ping();

    expect(ping.message).toBe("pong");
    expect(typeof ping.id).toBe("number");
    expect(ping.createdAt).toBeInstanceOf(Date);
  });
});
