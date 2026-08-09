import type { SaleCatalog, SaleMenuItem } from "@/features/sale/types.ts";

const categories = [
  { id: "breakfast", name: "Breakfast" },
  { id: "coffee", name: "Coffee" },
  { id: "pasta", name: "Pasta" },
  { id: "desserts", name: "Desserts" },
  { id: "rice", name: "Rice meals" },
  { id: "drinks", name: "Drinks" },
];

const sizeGroup = {
  id: "size",
  name: "Size",
  selectionRule: "required-one" as const,
  maximum: null,
  defaultModifierId: "whole",
  modifiers: [
    { id: "whole", name: "Whole", delta: { kind: "multiplier" as const, perMille: 1000 } },
    { id: "half", name: "Half", delta: { kind: "multiplier" as const, perMille: 500 } },
  ],
};

const doneness = {
  id: "doneness",
  name: "Doneness",
  selectionRule: "optional-one" as const,
  maximum: null,
  defaultModifierId: null,
  modifiers: [
    { id: "rare", name: "Rare", delta: { kind: "absolute" as const, amountCentavos: 0 } },
    { id: "medium", name: "Medium", delta: { kind: "absolute" as const, amountCentavos: 0 } },
    { id: "well", name: "Well done", delta: { kind: "absolute" as const, amountCentavos: 0 } },
    { id: "nosalt", name: "Without salt", delta: { kind: "absolute" as const, amountCentavos: 0 } },
    { id: "spicy", name: "More spices", delta: { kind: "absolute" as const, amountCentavos: 1_500 } },
  ],
};

const milk = {
  id: "milk",
  name: "Milk",
  selectionRule: "optional-one" as const,
  maximum: null,
  defaultModifierId: "whole-milk",
  modifiers: [
    { id: "whole-milk", name: "Whole milk", delta: { kind: "absolute" as const, amountCentavos: 0 } },
    { id: "oat", name: "Oat", delta: { kind: "absolute" as const, amountCentavos: 3_000 } },
    { id: "soy", name: "Soy", delta: { kind: "absolute" as const, amountCentavos: 2_500 } },
    { id: "almond", name: "Almond", delta: { kind: "absolute" as const, amountCentavos: 3_500 } },
  ],
};

const riceAddOns = [
  {
    id: "extra-rice",
    name: "Extra rice",
    delta: { kind: "absolute" as const, amountCentavos: 1_500 },
    maximum: 3,
  },
  {
    id: "itlog",
    name: "Fried egg",
    delta: { kind: "absolute" as const, amountCentavos: 2_000 },
    maximum: 2,
  },
  {
    id: "atchara",
    name: "Atchara",
    delta: { kind: "absolute" as const, amountCentavos: 0 },
    maximum: 1,
  },
];

const featured: SaleMenuItem[] = [
  {
    id: "adobo",
    categoryId: "rice",
    name: "Chicken adobo",
    priceCentavos: 26_500,
    available: true,
    variants: [
      { id: "adobo-solo", name: "Solo", priceCentavos: 26_500, available: true },
      { id: "adobo-family", name: "Family", priceCentavos: 48_000, available: true },
    ],
    modifierGroups: [sizeGroup],
    addOns: riceAddOns,
  },
  {
    id: "tapa",
    categoryId: "breakfast",
    name: "Beef tapa",
    priceCentavos: 28_500,
    available: true,
    variants: [],
    modifierGroups: [doneness],
    addOns: riceAddOns,
  },
  {
    id: "bangus",
    categoryId: "breakfast",
    name: "Crispy bangus",
    priceCentavos: 27_500,
    available: true,
    variants: [
      { id: "bangus-half", name: "Half", priceCentavos: 27_500, available: true },
      { id: "bangus-whole", name: "Whole", priceCentavos: 42_000, available: false },
    ],
    modifierGroups: [],
    addOns: riceAddOns,
  },
  {
    id: "latte",
    categoryId: "coffee",
    name: "Iced latte",
    priceCentavos: 15_500,
    available: true,
    variants: [
      { id: "latte-12", name: "12 oz", priceCentavos: 15_500, available: true },
      { id: "latte-16", name: "16 oz", priceCentavos: 18_500, available: true },
      { id: "latte-22", name: "22 oz", priceCentavos: 21_500, available: true },
    ],
    modifierGroups: [milk],
    addOns: [
      {
        id: "shot",
        name: "Extra shot",
        delta: { kind: "absolute" as const, amountCentavos: 4_000 },
        maximum: 3,
      },
      {
        id: "syrup",
        name: "Vanilla syrup",
        delta: { kind: "absolute" as const, amountCentavos: 2_000 },
        maximum: 2,
      },
    ],
  },
  {
    id: "tofu",
    categoryId: "rice",
    name: "Tofu sisig",
    priceCentavos: 24_500,
    available: true,
    variants: [],
    modifierGroups: [],
    addOns: [],
  },
  {
    id: "water",
    categoryId: "drinks",
    name: "Bottled water",
    priceCentavos: 2_000,
    available: true,
    variants: [],
    modifierGroups: [],
    addOns: [],
  },
  {
    id: "halohalo",
    categoryId: "desserts",
    name: "Halo-halo",
    priceCentavos: 16_000,
    available: false,
    variants: [],
    modifierGroups: [],
    addOns: [],
  },
];

// Bulk filler so the grid runs at a realistic 80-item density.
const filler = Array.from({ length: 73 }, (_, index): SaleMenuItem => {
  const category = categories[index % categories.length]!;
  return {
    id: `filler-${index}`,
    categoryId: category.id,
    name: `${category.name} special ${String(index + 1).padStart(3, "0")}`,
    priceCentavos: 9_000 + ((index * 1_750) % 26_000),
    available: index % 17 !== 0,
    variants: [],
    modifierGroups: [],
    addOns: [],
  };
});

export const prototypeCatalog: SaleCatalog = {
  categories,
  menuItems: [...featured, ...filler],
};
