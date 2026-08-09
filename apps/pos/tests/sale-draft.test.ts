import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  addOptionlessLine,
  clearDraft,
  createDraft,
  readDraft,
  writeDraft,
} from "@/features/sale/draft-store.ts";

describe("sale draft", () => {
  beforeEach(() => localStorage.clear());

  it("starts with a client id, persists optionless lines, and restores them after a reload", () => {
    const draft = createDraft();
    const next = addOptionlessLine(draft, {
      menuItemId: "water",
      menuItemName: "Water",
      variantId: "bottle",
      variantName: "Bottle",
      unitPriceCentavos: 2_000,
    });

    writeDraft(next);

    expect(next.id).toMatch(/^[0-9a-f]{8}-/);
    expect(readDraft()).toEqual(next);
    expect(next.totalCentavos).toBe(2_000);
  });

  it("clears an empty or populated local draft without a server request", () => {
    const draft = addOptionlessLine(createDraft(), {
      menuItemId: "water",
      menuItemName: "Water",
      variantId: "bottle",
      variantName: "Bottle",
      unitPriceCentavos: 2_000,
    });
    writeDraft(draft);

    clearDraft();

    expect(readDraft()).toBeNull();
  });
});
