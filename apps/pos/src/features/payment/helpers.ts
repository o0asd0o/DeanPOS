export type PaymentMethodBrand = "GCash" | "Maya";

export function getPaymentMethodBrand(methodName: string): PaymentMethodBrand | null {
  const normalizedName = methodName.toLowerCase().replaceAll(" ", "");
  if (normalizedName === "gcash") return "GCash";
  if (normalizedName === "maya" || normalizedName === "paymaya") return "Maya";
  return null;
}
