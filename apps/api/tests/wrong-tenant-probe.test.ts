import { describe, expect, it } from "vite-plus/test";

import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

const ownerSees = { id: "owner-row" };

describe("expectWrongTenantRefusal: exact refusal shapes", () => {
  it("rejects a missing return (undefined) as a refusal", async () => {
    await expect(
      expectWrongTenantRefusal({
        path: "fake.path",
        mode: "refusal",
        ownerSees,
        otherGets: async () => undefined as unknown as typeof ownerSees,
      }),
    ).rejects.toThrow(/expected a refusal shape/);
  });

  it("rejects { ok: false, ...leakedData } — a refusal riding alongside a leak", async () => {
    await expect(
      expectWrongTenantRefusal({
        path: "fake.path",
        mode: "refusal",
        ownerSees,
        otherGets: async () => ({ ok: false, id: "owner-row" }) as unknown as typeof ownerSees,
      }),
    ).rejects.toThrow(/expected a refusal shape/);
  });

  it("rejects { authenticated: false, ...leakedData } — a refusal riding alongside a leak", async () => {
    await expect(
      expectWrongTenantRefusal({
        path: "fake.path",
        mode: "refusal",
        ownerSees,
        otherGets: async () =>
          ({ authenticated: false, id: "owner-row" }) as unknown as typeof ownerSees,
      }),
    ).rejects.toThrow(/expected a refusal shape/);
  });

  it("accepts the exact shape { ok: false }", async () => {
    await expect(
      expectWrongTenantRefusal({
        path: "fake.path",
        mode: "refusal",
        ownerSees,
        otherGets: async () => ({ ok: false }) as unknown as typeof ownerSees,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('expectWrongTenantRefusal: mode "effect"', () => {
  it("requires otherUnaffected", async () => {
    await expect(
      expectWrongTenantRefusal({
        path: "fake.path",
        mode: "effect",
        ownerSees,
        otherGets: async () => ownerSees,
        why: "a write whose own result carries no tenant data at all",
      }),
    ).rejects.toThrow(/requires otherUnaffected/);
  });

  it("fails when otherUnaffected resolves false", async () => {
    await expect(
      expectWrongTenantRefusal({
        path: "fake.path",
        mode: "effect",
        ownerSees,
        otherGets: async () => ownerSees,
        otherUnaffected: async () => false,
        why: "a write whose own result carries no tenant data at all",
      }),
    ).rejects.toThrow(/otherUnaffected\(\) returned false/);
  });

  it("passes when the other Tenant's own result matches and otherUnaffected resolves true", async () => {
    await expect(
      expectWrongTenantRefusal({
        path: "fake.path",
        mode: "effect",
        ownerSees,
        otherGets: async () => ownerSees,
        otherUnaffected: async () => true,
        why: "a write whose own result carries no tenant data at all",
      }),
    ).resolves.toBeUndefined();
  });
});
