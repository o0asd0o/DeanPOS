import { createHash } from "node:crypto";

import {
  PAYMENT_DETAIL_IMAGE_MAX_BYTES,
  sniffPaymentDetailImageMime,
} from "schemas/src/payment-detail-image.ts";

export type ValidatedImage = { bytes: Buffer; mime: string; sha256: string; byteLength: number };

// Server-proxied, validated before storage (issue 14 acceptance criterion 5):
// magic bytes decide the type, never a declared content type or filename, so
// an SVG renamed to `.png` is refused with everything else that isn't PNG/JPEG.
export const validatePaymentDetailImage = (base64: string): ValidatedImage | { error: string } => {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) return { error: "empty image" };
  if (bytes.length > PAYMENT_DETAIL_IMAGE_MAX_BYTES) return { error: "image exceeds 1MB" };

  const mime = sniffPaymentDetailImageMime(bytes);
  if (!mime) return { error: "only PNG and JPEG images are accepted" };

  return {
    bytes,
    mime,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
  };
};
