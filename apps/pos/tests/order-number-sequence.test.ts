import { describe, expect, it, vi } from "vite-plus/test";

import { submitNumberedDraft } from "@/features/payment/submit-numbered-draft.ts";
import { readDraft } from "@/features/sale/draft-store.ts";
import {
  assignOrderNumber,
  ORDER_SEQUENCE_EXHAUSTED_MESSAGE,
} from "@/lib/order-number-sequence.ts";

const identity = {
  deviceId: "device-a",
  name: "Counter 2",
  code: "C2",
  storeId: "store-a",
  storeName: "Malabon",
};

const draft = () => ({ id: crypto.randomUUID(), lines: [], totalCentavos: 0 });

describe("device order-number sequence", () => {
  it("allocates a zero-padded sequence per Device and reuses a Draft reservation", () => {
    localStorage.clear();
    const first = assignOrderNumber(draft(), identity);
    expect(first).toMatchObject({ deviceSequence: 1, orderNumber: "C2-0001" });
    expect(assignOrderNumber(first, identity)).toBe(first);
    expect(assignOrderNumber(draft(), identity)).toMatchObject({
      deviceSequence: 2,
      orderNumber: "C2-0002",
    });
    expect(
      assignOrderNumber(draft(), { ...identity, deviceId: "device-b", code: "K1" }),
    ).toMatchObject({ deviceSequence: 1, orderNumber: "K1-0001" });
  });

  it("refuses a corrupt or exhausted counter instead of risking reuse", () => {
    localStorage.clear();
    localStorage.setItem("deanpos.order-sequence.device-a", "broken");
    expect(() => assignOrderNumber(draft(), identity)).toThrow(ORDER_SEQUENCE_EXHAUSTED_MESSAGE);
    localStorage.setItem("deanpos.order-sequence.device-a", "2147483647");
    expect(() => assignOrderNumber(draft(), identity)).toThrow(ORDER_SEQUENCE_EXHAUSTED_MESSAGE);
  });

  it("persists the assigned number before a transport failure", async () => {
    localStorage.clear();
    const transport = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(
      submitNumberedDraft({ draft: draft(), identity, onPrepared: vi.fn(), transport }),
    ).rejects.toThrow("offline");

    expect(transport).toHaveBeenCalledOnce();
    expect(readDraft()).toMatchObject({ deviceSequence: 1, orderNumber: "C2-0001" });
  });
});
