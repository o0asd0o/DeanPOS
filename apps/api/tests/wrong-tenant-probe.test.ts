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
  it("requires otherBefore and otherAfter", async () => {
    await expect(
      expectWrongTenantRefusal({
        path: "fake.path",
        mode: "effect",
        ownerSees,
        otherGets: async () => ownerSees,
        why: "a write whose own result carries no tenant data at all",
      }),
    ).rejects.toThrow(/requires otherBefore and otherAfter/);
  });

  it("fails when the other Tenant's before and after reads differ — the helper compares them itself", async () => {
    await expect(
      expectWrongTenantRefusal({
        path: "fake.path",
        mode: "effect",
        ownerSees,
        otherGets: async () => ownerSees,
        otherBefore: "untouched",
        otherAfter: async () => "touched",
        why: "a write whose own result carries no tenant data at all",
      }),
    ).rejects.toThrow(/before\/after read differ/);
  });

  it("passes when the other Tenant's before and after reads are identical", async () => {
    await expect(
      expectWrongTenantRefusal({
        path: "fake.path",
        mode: "effect",
        ownerSees,
        otherGets: async () => ownerSees,
        otherBefore: "untouched",
        otherAfter: async () => "untouched",
        why: "a write whose own result carries no tenant data at all",
      }),
    ).resolves.toBeUndefined();
  });
});
