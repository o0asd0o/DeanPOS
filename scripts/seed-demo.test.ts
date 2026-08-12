import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("demo seed", () => {
  it("defines a small, realistic multi-tenant carinderia fixture", async () => {
    const source = await readFile(new URL("./seed-demo.ts", import.meta.url), "utf8");

    expect(source).toContain("const tenantSeeds = [");
    expect(source).toContain('key: "nanays-kusina"');
    expect(source).toContain('key: "kusina-ni-rosa"');
    expect(source).toContain("const storeSeeds = [");
    expect(source).toContain("const menuItemSeeds = [");
    expect(source).toContain("const paymentMethodSeeds = [");
    expect(source).toContain('key: "gcash"');
    expect(source).toContain('key: "cash"');
    expect(source).toContain('key: "paymaya"');
    expect(source).toContain('TRUNCATE TABLE "Tenant" CASCADE');
  });

  it("uses the PaymentMethodAvailability natural key for replay-safe inserts", async () => {
    const source = await readFile(new URL("./seed-demo.ts", import.meta.url), "utf8");
    expect(source).toContain('oc.columns(["payment_method_id", "store_id"])');
  });
});
