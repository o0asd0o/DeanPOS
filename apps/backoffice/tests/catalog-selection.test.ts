import { describe, expect, it } from "vite-plus/test";

import { resolveCatalogCategoryId, type CategoryOutput } from "@/features/catalog/helpers.ts";

const category = (id: string, archivedAt: Date | null = null): CategoryOutput => ({
  id,
  tenantId: "tenant",
  name: id,
  sortOrder: 0,
  archivedAt,
  createdAt: new Date("2026-01-01"),
});

describe("catalog category selection", () => {
  const categories = [category("breakfast"), category("coffee"), category("pasta")];

  it("keeps the selected active category instead of resetting to the first category", () => {
    expect(resolveCatalogCategoryId(categories, "pasta")).toBe("pasta");
  });

  it("falls back to the first active category only when the current selection is unavailable", () => {
    expect(resolveCatalogCategoryId(categories, "missing")).toBe("breakfast");
    expect(
      resolveCatalogCategoryId([category("breakfast"), category("coffee", new Date())], "coffee"),
    ).toBe("breakfast");
  });
});
