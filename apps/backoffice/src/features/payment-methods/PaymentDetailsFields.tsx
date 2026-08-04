import { useEffect, useRef, useState } from "react";
import { UploadCloudIcon, XIcon } from "lucide-react";
import { Button, Input, cn } from "ui";
import {
  PAYMENT_DETAIL_IMAGE_MAX_BYTES,
  sniffPaymentDetailImageMime,
} from "schemas/src/payment-detail-image.ts";

import { Hint } from "@/components/Hint.tsx";

// A client-side echo of the server's own check (validate-payment-detail-image.ts)
// so a refused upload never round-trips just to announce itself — the server
// remains the one that actually decides (issue 14 acceptance criterion 5).
async function readAndValidateImage(
  file: File,
): Promise<
  { ok: true; base64: string; mime: string; previewUrl: string } | { ok: false; reason: string }
> {
  if (file.size > PAYMENT_DETAIL_IMAGE_MAX_BYTES)
    return { ok: false, reason: "That image is larger than 1MB" };
  const buffer = new Uint8Array(await file.arrayBuffer());
  const mime = sniffPaymentDetailImageMime(buffer);
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
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Revokes the object URL this component created — on replacement, on
  // Remove, and on unmount — never the server's own `data:` preview.
  useEffect(() => {
    const activeUrl = value.image.kind === "new" ? value.image.previewUrl : null;
    return () => {
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [value.image]);

  const previewUrl =
    value.image.kind === "new"
      ? value.image.previewUrl
      : value.image.kind === "unchanged"
        ? (existingImageDataUrl ?? null)
        : null;

  // The one path a file takes, whether it was picked or dropped.
  const acceptFile = async (file: File | undefined) => {
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
          Optional. A screenshot of the QR code the till already prints — DeanPOS never verifies
          that a scan against it was actually paid.
        </Hint>
        {/* The file input stays the keyboard control — `sr-only`, still the
            label's target — so the drop area needs no ARIA of its own. */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void acceptFile(event.dataTransfer.files[0]);
          }}
          className={cn(
            "relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center transition-colors",
            "focus-within:ring-2 focus-within:ring-ring hover:bg-hover",
            isDragging && "border-primary bg-hover",
          )}
        >
          <input
            ref={fileInputRef}
            id="payment-method-qr-image"
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            aria-describedby={uploadError ? "payment-method-qr-image-error" : undefined}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void acceptFile(file);
            }}
          />
          {previewUrl && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Remove QR image"
              className="absolute top-2 right-2"
              onClick={(event) => {
                event.stopPropagation();
                setUploadError(null);
                onChange({ ...value, image: { kind: "none" } });
              }}
            >
              <XIcon />
            </Button>
          )}
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="The uploaded QR code for this payment method"
              className="h-32 w-32 rounded-xl border bg-background object-contain"
            />
          ) : (
            <UploadCloudIcon className="size-8 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">
            {previewUrl ? "Drop a new image to replace it, or " : "Drag an image here, or "}
            <span className="font-medium text-foreground underline">browse</span>
            <span className="block text-xs">PNG or JPEG, up to 1MB</span>
          </p>
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
