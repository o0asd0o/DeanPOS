import { afterAll, describe, expect, it } from "vite-plus/test";

import { createDb, type DatabaseInstance } from "../../src/db/client.ts";
import { handler } from "../../src/ping/handlers/get-ping.ts";

const db: DatabaseInstance = createDb({ databaseUrl: process.env.DATABASE_URI! });

afterAll(async () => {
  await db.destroy();
});

describe("ping handler", () => {
  it("reads the seeded ping row with no HTTP server involved", async () => {
    const ping = await handler({ ctx: { db, kind: "unauthenticated" }, input: undefined });

    expect(ping.message).toBe("pong");
  });
});
