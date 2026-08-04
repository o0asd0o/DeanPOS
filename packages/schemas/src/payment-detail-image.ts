// Shared between the server's magic-byte check and the client's echo of it
// (issue 14 acceptance criterion 5) — one source for PNG/JPEG detection and
// the 1MB ceiling, so a format added on one side is never missed on the other.
export const PAYMENT_DETAIL_IMAGE_MAX_BYTES = 1024 * 1024;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

const startsWith = (bytes: Uint8Array, magic: number[]) =>
  magic.every((byte, index) => bytes[index] === byte);

export function sniffPaymentDetailImageMime(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  if (startsWith(bytes, PNG_MAGIC)) return "image/png";
  if (startsWith(bytes, JPEG_MAGIC)) return "image/jpeg";
  return null;
}
