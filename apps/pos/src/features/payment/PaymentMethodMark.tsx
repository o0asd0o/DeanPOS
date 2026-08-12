import gcashBrandMarkUrl from "@/assets/gcash-brand-mark.png";
import mayaBrandMarkUrl from "@/assets/maya-brand-mark.png";
import type { PaymentMethodBrand } from "./helpers.ts";

type Props = {
  brand: PaymentMethodBrand;
};

export function PaymentMethodMark({ brand }: Props) {
  return (
    <img
      alt=""
      className="h-7 w-auto max-w-28 rounded-sm object-contain"
      src={brand === "GCash" ? gcashBrandMarkUrl : mayaBrandMarkUrl}
    />
  );
}
