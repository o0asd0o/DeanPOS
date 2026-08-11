import { writeDraft, type Draft } from "@/features/sale/draft-store.ts";
import type { DeviceIdentity } from "@/lib/device-token.ts";
import { assignOrderNumber } from "@/lib/order-number-sequence.ts";

type Input<T> = {
  draft: Draft;
  identity: DeviceIdentity;
  onPrepared: (draft: Draft) => void;
  transport: (draft: Draft) => Promise<T>;
};

export async function submitNumberedDraft<T>({
  draft,
  identity,
  onPrepared,
  transport,
}: Input<T>): Promise<T> {
  const numberedDraft = assignOrderNumber(draft, identity);
  writeDraft(numberedDraft);
  onPrepared(numberedDraft);
  return transport(numberedDraft);
}
