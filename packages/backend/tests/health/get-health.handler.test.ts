import { afterAll, describe, expect, it } from "vite-plus/test";

import { createDb, type DatabaseInstance } from "../../src/db/client.ts";
import { handler } from "../../src/health/handlers/get-health.ts";

const db: DatabaseInstance = createDb({ databaseUrl: process.env.DATABASE_URI! });

afterAll(async () => {
  await db.destroy();
});

describe("health handler", () => {
  it("reports the process live and the database reachable as two booleans", async () => {
    const health = await handler({ ctx: { db, kind: "unauthenticated" }, input: undefined });

    expect(health).toStrictEqual({ live: true, databaseReachable: true });
  });

  it("reports the database unreachable without throwing when the connection is broken", async () => {
    const brokenDb = createDb({ databaseUrl: "postgresql://nobody@localhost:1/does-not-exist" });

    const health = await handler({
      ctx: { db: brokenDb, kind: "unauthenticated" },
      input: undefined,
    });

    expect(health).toStrictEqual({ live: true, databaseReachable: false });

    await brokenDb.destroy();
  });
});
