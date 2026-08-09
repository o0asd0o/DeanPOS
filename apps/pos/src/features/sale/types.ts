export type SaleVariant = { id: string; name: string; priceCentavos: number; available: boolean };

export type SaleMenuItem = {
  id: string;
  categoryId: string;
  name: string;
  priceCentavos: number;
  available: boolean;
  variants: SaleVariant[];
  modifierGroups: unknown[];
  addOns: unknown[];
};
