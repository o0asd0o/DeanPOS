import { afterAll, describe, expect, it } from "vite-plus/test";

import { createDb, type DatabaseInstance } from "../../src/db/client.ts";
import { getPing } from "../../src/ping/db-operations/queries/get-ping.query.ts";

const db: DatabaseInstance = createDb({ databaseUrl: process.env.DATABASE_URI! });

afterAll(async () => {
  await db.destroy();
});

describe("getPing", () => {
  it("reads the seeded ping row through Kysely", async () => {
    const ping = await getPing(db);

    expect(ping.message).toBe("pong");
  });
});
