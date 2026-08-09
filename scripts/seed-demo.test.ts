import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("demo seed", () => {
  it("uses the PaymentMethodAvailability natural key for replay-safe inserts", async () => {
    const source = await readFile(new URL("./seed-demo.ts", import.meta.url), "utf8");
    const availabilityInsert = source.slice(
      source.indexOf('.insertInto("PaymentMethodAvailability")'),
      source.indexOf("const baseDeviceSeeds"),
    );

    expect(availabilityInsert).toContain('oc.columns(["payment_method_id", "store_id"])');
  });
});
