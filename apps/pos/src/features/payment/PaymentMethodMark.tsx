import paymentMethodBrandMarksUrl from "@/assets/gcash-maya-brand-marks.png";

type Props = {
  methodName: string;
};

export function PaymentMethodMark({ methodName }: Props) {
  const normalizedName = methodName.toLowerCase().replaceAll(" ", "");
  const brand =
    normalizedName === "gcash"
      ? "GCash"
      : normalizedName === "maya" || normalizedName === "paymaya"
        ? "Maya"
        : null;

  if (!brand) return null;

  return (
    <svg
      aria-label={`${brand} official mark`}
      role="img"
      className="size-8 overflow-hidden rounded-sm"
      viewBox={brand === "GCash" ? "16 33 306 305" : "337 33 304 305"}
    >
      <image href={paymentMethodBrandMarksUrl} width="660" height="370" />
    </svg>
  );
}
