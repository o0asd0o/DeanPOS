export type SaleDelta =
  | { kind: "absolute"; amountCentavos: number }
  | { kind: "multiplier"; perMille: number };
export type SaleModifier = { id: string; name: string; delta: SaleDelta };
export type SaleModifierGroup = {
  id: string;
  name: string;
  selectionRule: "required-one" | "optional-one" | "many";
  maximum: number | null;
  defaultModifierId: string | null;
  modifiers: SaleModifier[];
};
export type SaleAddOn = { id: string; name: string; delta: SaleDelta; maximum: number | null };
export type SaleVariant = { id: string; name: string; priceCentavos: number; available: boolean };
export type SalePaymentMethod = { id: string; name: string; kind: "cash" | "recorded" };

export type SaleMenuItem = {
  id: string;
  categoryId: string;
  name: string;
  priceCentavos: number;
  available: boolean;
  variants: SaleVariant[];
  modifierGroups: SaleModifierGroup[];
  addOns: SaleAddOn[];
};

export type SaleCatalog = {
  categories: { id: string; name: string }[];
  menuItems: SaleMenuItem[];
  paymentMethods: SalePaymentMethod[];
};
