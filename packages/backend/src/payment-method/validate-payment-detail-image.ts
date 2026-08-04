import { createHash } from "node:crypto";

const MAX_BYTES = 1024 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

const startsWith = (bytes: Buffer, magic: number[]) =>
  magic.every((byte, index) => bytes[index] === byte);

export type ValidatedImage = { bytes: Buffer; mime: string; sha256: string; byteLength: number };

// Server-proxied, validated before storage (issue 14 acceptance criterion 5):
// magic bytes decide the type, never a declared content type or filename, so
// an SVG renamed to `.png` is refused with everything else that isn't PNG/JPEG.
export const validatePaymentDetailImage = (base64: string): ValidatedImage | { error: string } => {
  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64, "base64");
  } catch {
    return { error: "not valid base64" };
  }
  if (bytes.length === 0) return { error: "empty image" };
  if (bytes.length > MAX_BYTES) return { error: "image exceeds 1MB" };

  const mime = startsWith(bytes, PNG_MAGIC)
    ? "image/png"
    : startsWith(bytes, JPEG_MAGIC)
      ? "image/jpeg"
      : null;
  if (!mime) return { error: "only PNG and JPEG images are accepted" };

  return {
    bytes,
    mime,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
  };
};
