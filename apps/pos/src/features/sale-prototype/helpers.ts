import type { SaleDelta } from "@/features/sale/types.ts";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export const formatPeso = (centavos: number) => peso.format(centavos / 100);

// A multiplier is meaningless to a cashier — price it against this variant.
export const formatDelta = (delta: SaleDelta, baseCentavos: number) => {
  const amount =
    delta.kind === "absolute"
      ? delta.amountCentavos
      : Math.round((baseCentavos * delta.perMille) / 1000) - baseCentavos;
  if (amount === 0) return "—";
  return `${amount > 0 ? "+" : "−"}${formatPeso(Math.abs(amount))}`;
};
