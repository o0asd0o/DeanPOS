import { useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { Button, Input } from "ui";

import { Hint } from "@/components/Hint.tsx";

const MAX_BYTES = 1024 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

const startsWith = (bytes: Uint8Array, magic: number[]) =>
  magic.every((byte, index) => bytes[index] === byte);

// A client-side echo of the server's own check (validate-payment-detail-image.ts)
// so a refused upload never round-trips just to announce itself — the server
// remains the one that actually decides (issue 14 acceptance criterion 5).
async function readAndValidateImage(
  file: File,
): Promise<
  { ok: true; base64: string; mime: string; previewUrl: string } | { ok: false; reason: string }
> {
  if (file.size > MAX_BYTES) return { ok: false, reason: "That image is larger than 1MB" };
  const buffer = new Uint8Array(await file.arrayBuffer());
  const mime = startsWith(buffer, PNG_MAGIC)
    ? "image/png"
    : startsWith(buffer, JPEG_MAGIC)
      ? "image/jpeg"
      : null;
  if (!mime) return { ok: false, reason: "Only PNG and JPEG images are accepted" };
  let binary = "";
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return { ok: true, base64: btoa(binary), mime, previewUrl: URL.createObjectURL(file) };
}

export type PaymentDetailsImageState =
  | { kind: "unchanged" }
  | { kind: "none" }
  | { kind: "new"; base64: string; mime: string; previewUrl: string };

export type PaymentDetailsValue = {
  accountName: string;
  accountNumber: string;
  image: PaymentDetailsImageState;
};

// Joins the payment method's editor sheet behind its one Save (issue 14,
// record 066 Q7): every field here rides `paymentMethod.create`/`.update`,
// never a route of its own.
export function PaymentDetailsFields({
  value,
  onChange,
  existingImageDataUrl,
}: {
  value: PaymentDetailsValue;
  onChange: (value: PaymentDetailsValue) => void;
  existingImageDataUrl: string | null | undefined;
}) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const previewUrl =
    value.image.kind === "new"
      ? value.image.previewUrl
      : value.image.kind === "unchanged"
        ? (existingImageDataUrl ?? null)
        : null;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await readAndValidateImage(file);
    if (!result.ok) {
      setUploadError(result.reason);
      return;
    }
    setUploadError(null);
    onChange({
      ...value,
      image: {
        kind: "new",
        base64: result.base64,
        mime: result.mime,
        previewUrl: result.previewUrl,
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="payment-method-account-name">Account name</label>
        <Input
          id="payment-method-account-name"
          placeholder="Juan Dela Cruz"
          value={value.accountName}
          onChange={(event) => onChange({ ...value, accountName: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="payment-method-account-number">Account number</label>
        <Input
          id="payment-method-account-number"
          placeholder="0917 123 4567"
          value={value.accountNumber}
          onChange={(event) => onChange({ ...value, accountNumber: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="payment-method-qr-image">QR image</label>
        <Hint>
          Optional. A screenshot of the QR code the till already prints — this records nothing and
          does not verify that a scan was actually paid.
        </Hint>
        {previewUrl && (
          <img
            src={previewUrl}
            alt="The uploaded QR code for this payment method"
            className="h-32 w-32 rounded-xl border object-contain"
          />
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            id="payment-method-qr-image"
            type="file"
            accept="image/png,image/jpeg"
            aria-describedby={uploadError ? "payment-method-qr-image-error" : undefined}
            onChange={(event) => void handleFileChange(event)}
          />
          {previewUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setUploadError(null);
                onChange({ ...value, image: { kind: "none" } });
              }}
            >
              <XIcon />
              Remove
            </Button>
          )}
        </div>
        {uploadError && (
          <p
            id="payment-method-qr-image-error"
            role="alert"
            className="rounded-md bg-status-danger-tint p-3 text-sm text-foreground"
          >
            {uploadError}
          </p>
        )}
      </div>
    </div>
  );
}
