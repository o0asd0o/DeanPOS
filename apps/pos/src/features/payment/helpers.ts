import { composeLine, type Draft } from "../sale/draft-store.ts";
import type { SaleCatalog } from "../sale/types.ts";

export type PaymentMethodBrand = "GCash" | "Maya";

export function getPaymentMethodBrand(
  methodName: string,
): PaymentMethodBrand | null {
  const normalizedName = methodName.toLowerCase().replaceAll(" ", "");
  if (normalizedName === "gcash") return "GCash";
  if (normalizedName === "maya" || normalizedName === "paymaya") return "Maya";
  return null;
}

export const QUICK_TENDER_PESOS = [100, 200, 500, 1_000] as const;

export function parseTenderedCentavos(value: string): number | null {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return null;
  const [pesos, fraction = ""] = value.split(".");
  const centavos = Number(pesos) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) && centavos <= 2_147_483_647
    ? centavos
    : null;
}

export function formatTenderInput(centavos: number): string {
  const pesos = Math.floor(centavos / 100);
  const remainder = centavos % 100;
  return remainder === 0
    ? String(pesos)
    : `${pesos}.${String(remainder).padStart(2, "0")}`;
}

export function getLineDiscountDetail(
  line: Draft["lines"][number],
  catalog: SaleCatalog,
): { name: string; amountCentavos: number } | null {
  const discount = (catalog.discounts ?? []).find(
    (candidate) => candidate.id === line.lineDiscountId,
  );
  const item = catalog.menuItems.find(
    (candidate) => candidate.id === line.menuItemId,
  );
  if (!discount || !item) return null;
  const undiscountedTotal = composeLine(
    line,
    item.modifierGroups.flatMap((group) => group.modifiers),
    item.addOns,
  ).totalCentavos;
  return {
    name: discount.name,
    amountCentavos: Math.max(0, undiscountedTotal - line.totalCentavos),
  };
}
