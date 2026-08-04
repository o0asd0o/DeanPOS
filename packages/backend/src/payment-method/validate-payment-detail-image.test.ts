import { describe, expect, it } from "vite-plus/test";

import { validatePaymentDetailImage } from "./validate-payment-detail-image.ts";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const SVG_BYTES = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>");

describe("validatePaymentDetailImage", () => {
  it("accepts a PNG, decided by magic bytes", () => {
    const bytes = Buffer.concat([PNG_MAGIC, Buffer.from("rest of the file")]);
    const result = validatePaymentDetailImage(bytes.toString("base64"));

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.mime).toBe("image/png");
    expect(result.byteLength).toBe(bytes.length);
    expect(result.sha256).toHaveLength(64);
  });

  it("accepts a JPEG, decided by magic bytes", () => {
    const bytes = Buffer.concat([JPEG_MAGIC, Buffer.from("rest of the file")]);
    const result = validatePaymentDetailImage(bytes.toString("base64"));

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.mime).toBe("image/jpeg");
  });

  it("refuses an SVG renamed to .png — magic bytes, not the filename or a declared type", () => {
    const result = validatePaymentDetailImage(SVG_BYTES.toString("base64"));

    expect(result).toEqual({ error: "only PNG and JPEG images are accepted" });
  });

  it("refuses raw bytes above 1MB", () => {
    const bytes = Buffer.concat([PNG_MAGIC, Buffer.alloc(1024 * 1024)]);
    const result = validatePaymentDetailImage(bytes.toString("base64"));

    expect(result).toEqual({ error: "image exceeds 1MB" });
  });

  it("accepts raw bytes exactly at the 1MB ceiling", () => {
    const bytes = Buffer.concat([PNG_MAGIC, Buffer.alloc(1024 * 1024 - PNG_MAGIC.length)]);
    const result = validatePaymentDetailImage(bytes.toString("base64"));

    expect("error" in result).toBe(false);
  });

  it("refuses an empty image", () => {
    const result = validatePaymentDetailImage("");

    expect(result).toEqual({ error: "empty image" });
  });
});
