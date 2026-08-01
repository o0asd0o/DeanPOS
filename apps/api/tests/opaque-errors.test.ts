import { ORPCError } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import { createTestSeam } from "../src/test-seam.ts";

describe("opaque errors", () => {
  it("never leaks a stack trace, database error text, or connection detail when the database is unreachable", async () => {
    const seam = createTestSeam({
      databaseUrl: "postgresql://nobody:wrongpassword@127.0.0.1:1/does-not-exist",
    });

    let caught: unknown;
    try {
      await seam.client.ping();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ORPCError);
    const error = caught as ORPCError<string, unknown>;
    const wireShape = JSON.stringify(error.toJSON());

    expect(error.message).toBe("Internal server error");
    expect(wireShape).not.toMatch(
      /ECONNREFUSED|wrongpassword|does-not-exist|127\.0\.0\.1|postgres|pg_|node_modules|\.ts:\d+/i,
    );

    await seam.db.destroy();
  });
});
