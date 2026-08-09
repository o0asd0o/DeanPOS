import { createHash } from "node:crypto";

import { hashPassword } from "../packages/backend/src/common/password.ts";
import { createDb, withTenantScope } from "../packages/backend/src/db/client.ts";
import type { Role } from "../packages/backend/src/db/prisma/generated/types.ts";

const databaseUrl = process.env.DATABASE_URI;
if (!databaseUrl) {
  throw new Error("DATABASE_URI is required. Load .env before running seed:demo.");
}

const password = "DemoPass123!";
const passwordHash = await hashPassword(password);
const db = createDb({ databaseUrl });

const seedId = (kind: string, value: string): string => {
  const hex = createHash("sha256")
    .update(`deanpos-demo:${kind}:${value}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
};

const tenantId = seedId("tenant", "demo");

const baseDate = new Date("2026-08-01T08:00:00.000Z");
const dateAt = (minutes: number) => new Date(baseDate.getTime() + minutes * 60_000);

const baseStores = [
  { key: "uptown", name: "Uptown Mall", active: true, labels: ["A1", "A2", "B1", "B2"] },
  {
    key: "downtown",
    name: "Downtown Market",
    active: true,
    labels: ["T1", "T2", "T3", "T4", "T5"],
  },
  { key: "cebu", name: "Cebu Central", active: true, labels: ["Window", "Patio", "Bar"] },
  { key: "makati", name: "Makati Annex", active: false, labels: ["Front", "Back"] },
].map((store) => ({ ...store, id: seedId("store", store.key) }));
const stores = [
  ...baseStores,
  ...Array.from({ length: 36 }, (_, index) => {
    const number = index + 5;
    return {
      id: seedId("store", `branch-${number}`),
      key: `branch-${number}`,
      name: `${["BGC", "Quezon", "Pasig", "Davao", "Iloilo", "Alabang"][index % 6]} Branch ${String(number).padStart(2, "0")}`,
      active: index % 11 !== 10,
      labels: [`${number}A`, `${number}B`, `${number}C`],
    };
  }),
];

const staffSeeds: Array<{
  key: string;
  firstName: string;
  lastName: string;
  role: Role;
  active?: boolean;
}> = [
  ["maria", "Maria", "Santos", "manager"],
  ["jose", "Jose", "Reyes", "manager"],
  ["bea", "Bea", "Villanueva", "manager"],
  ["anton", "Anton", "Dela Cruz", "manager"],
  ["liza", "Liza", "Navarro", "manager"],
  ["carlo", "Carlo", "Mendoza", "manager"],
  ["ana", "Ana", "Garcia", "cashier"],
  ["ben", "Ben", "Cruz", "cashier"],
  ["carmen", "Carmen", "Flores", "cashier"],
  ["diego", "Diego", "Ramos", "cashier"],
  ["ella", "Ella", "Aquino", "cashier"],
  ["francis", "Francis", "Lim", "cashier"],
  ["gina", "Gina", "Torres", "cashier"],
  ["hugo", "Hugo", "Bautista", "cashier"],
  ["ian", "Ian", "Castillo", "cashier"],
  ["jessa", "Jessa", "Pascual", "cashier"],
  ["karl", "Karl", "Ocampo", "cashier"],
  ["mariel", "Mariel", "Tan", "cashier"],
  ["nina", "Nina", "Valdez", "cashier"],
  ["oliver", "Oliver", "Chua", "cashier"],
  ["pia", "Pia", "Mercado", "cashier"],
  ["quentin", "Quentin", "Soriano", "cashier"],
  ["rhea", "Rhea", "Manalo", "cashier"],
  ["simon", "Simon", "Lopez", "cashier", false],
] as const;
const baseStaff = staffSeeds.map(([key, firstName, lastName, role, active = true]) => ({
  key,
  firstName,
  lastName,
  role,
  active,
}));
const generatedFirstNames = [
  "Adrian",
  "Bianca",
  "Clarisse",
  "Dario",
  "Estelle",
  "Felix",
  "Grace",
  "Harvey",
  "Irene",
  "Jonas",
  "Kaye",
  "Leandro",
  "Mina",
  "Noel",
  "Odette",
];
const generatedLastNames = [
  "Aguilar",
  "Bautista",
  "Calderon",
  "Domingo",
  "Estrada",
  "Fernandez",
  "Gonzales",
  "Herrera",
  "Ilagan",
  "Jimenez",
  "Kintanar",
  "Lorenzo",
  "Macaraig",
  "Natividad",
  "Ortega",
  "Pineda",
  "Quizon",
];
const staff = [
  ...baseStaff,
  ...Array.from({ length: 225 }, (_, index) => {
    const number = index + 1;
    return {
      key: `staff-${String(number).padStart(3, "0")}`,
      firstName: generatedFirstNames[index % generatedFirstNames.length]!,
      lastName: generatedLastNames[index % generatedLastNames.length]!,
      role: index % 12 === 0 ? ("manager" as const) : ("cashier" as const),
      active: index % 23 !== 22,
    };
  }),
];

const admin = {
  id: seedId("user", "alex-rivera"),
  email: "alex.rivera@deanpos.local",
  firstName: "Alex",
  lastName: "Rivera",
};

const staffUsers = staff.map((user) => ({
  ...user,
  id: seedId("user", user.key),
  email: `${user.key}@deanpos.local`,
}));

const baseCategories = ["Coffee", "Breakfast", "Rice meals", "Pasta", "Desserts"].map(
  (name, index) => ({ id: seedId("category", name), name, sortOrder: index }),
);
const categories = [
  ...baseCategories,
  ...Array.from({ length: 95 }, (_, index) => {
    const number = index + 6;
    const name = `${["Seasonal", "Chef's", "Weekend", "Family", "Classic"][index % 5]} picks ${String(number).padStart(2, "0")}`;
    return { id: seedId("category", name), name, sortOrder: number - 1 };
  }),
];

const baseMenuItems = [
  ["Coffee", "House latte", 16500],
  ["Coffee", "Spanish latte", 18500],
  ["Coffee", "Cold brew", 17500],
  ["Coffee", "Matcha cloud", 19500],
  ["Breakfast", "Longsilog", 22500],
  ["Breakfast", "Avocado toast", 24000],
  ["Breakfast", "Pancake stack", 21000],
  ["Breakfast", "Garlic mushroom omelette", 23500],
  ["Rice meals", "Chicken adobo", 26500],
  ["Rice meals", "Beef tapa", 28500],
  ["Rice meals", "Crispy bangus", 27500],
  ["Rice meals", "Tofu sisig", 24500],
  ["Pasta", "Truffle cream pasta", 32500],
  ["Pasta", "Tomato basil penne", 25500],
  ["Pasta", "Spicy seafood linguine", 34500],
  ["Pasta", "Baked mac and cheese", 29500],
  ["Desserts", "Basque cheesecake", 18500],
  ["Desserts", "Ube tres leches", 19500],
  ["Desserts", "Chocolate chip cookie", 9500],
  ["Desserts", "Seasonal fruit bowl", 15000],
] as const;
const menuItems: Array<[string, string, number]> = [
  ...baseMenuItems,
  ...Array.from({ length: 380 }, (_, index) => {
    const category = categories[index % categories.length]!.name;
    const number = index + 1;
    return [
      category,
      `${category} special ${String(number).padStart(3, "0")}`,
      12_500 + ((index * 1_750) % 28_000),
    ];
  }),
];

await withTenantScope(db, tenantId, async (scopedDb) => {
  await scopedDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "DeanPOS Demo Cafe", timezone: "Asia/Manila" })
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  await scopedDb
    .insertInto("User")
    .values({
      id: admin.id,
      tenant_id: tenantId,
      email: admin.email,
      first_name: admin.firstName,
      last_name: admin.lastName,
      password_hash: passwordHash,
      role: "admin",
      active: true,
      must_change_password: false,
    })
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  await scopedDb
    .insertInto("UserRole")
    .values({
      id: seedId("user-role", admin.id),
      tenant_id: tenantId,
      user_id: admin.id,
      role: "admin",
      effective_from: baseDate,
    })
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  await scopedDb
    .insertInto("User")
    .values(
      staffUsers.map((user, index) => ({
        id: user.id,
        tenant_id: tenantId,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        password_hash: passwordHash,
        role: user.role,
        active: user.active,
        must_change_password: false,
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  await scopedDb
    .insertInto("UserRole")
    .values(
      staffUsers.map((user, index) => ({
        id: seedId("user-role", user.id),
        tenant_id: tenantId,
        user_id: user.id,
        role: user.role,
        effective_from: dateAt(index + 1),
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  await scopedDb
    .insertInto("Store")
    .values(
      stores.map((store) => ({
        id: store.id,
        tenant_id: tenantId,
        name: store.name,
        active: store.active,
        table_labels: store.labels,
        business_day_start: "08:00",
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  const userStoreRows = staffUsers.flatMap((user, index) => {
    const assignedStores = user.role === "manager" ? stores.slice(0, 3) : [stores[index % 3]!];
    return assignedStores.map((store, storeIndex) => ({
      id: seedId("user-store", `${user.id}:${store.id}`),
      tenant_id: tenantId,
      user_id: user.id,
      store_id: store.id,
      assigned: true,
      effective_from: dateAt(index * 10 + storeIndex),
    }));
  });
  await scopedDb
    .insertInto("UserStore")
    .values(userStoreRows)
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  const paymentMethods = [
    { key: "cash", name: "Cash", kind: "cash" as const },
    { key: "gcash", name: "GCash", kind: "recorded" as const },
    { key: "card", name: "Card terminal", kind: "recorded" as const },
    { key: "maya", name: "Maya QR", kind: "recorded" as const },
    ...Array.from({ length: 36 }, (_, index) => ({
      key: `recorded-${String(index + 1).padStart(2, "0")}`,
      name: `${["Wallet", "Bank transfer", "Card reader", "QR counter"][index % 4]} ${String(index + 1).padStart(2, "0")}`,
      kind: "recorded" as const,
    })),
  ];
  await scopedDb
    .insertInto("PaymentMethod")
    .values(
      paymentMethods.map((method) => ({
        id: seedId("payment-method", method.key),
        tenant_id: tenantId,
        name: method.name,
        kind: method.kind,
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  await scopedDb
    .insertInto("PaymentMethodAvailability")
    .values(
      paymentMethods
        .filter((method) => method.kind === "recorded")
        .flatMap((method, methodIndex) =>
          stores.slice(0, methodIndex === 2 ? 2 : 3).map((store) => ({
            id: seedId("payment-availability", `${method.key}:${store.key}`),
            tenant_id: tenantId,
            payment_method_id: seedId("payment-method", method.key),
            store_id: store.id,
          })),
        ),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  const baseDeviceSeeds = [
    ["Uptown Counter 1", "UP1", "uptown", staffUsers[0]!.id, -8, false],
    ["Uptown Counter 2", "UP2", "uptown", null, -34, false],
    ["Uptown Patio", "UP3", "uptown", staffUsers[6]!.id, -120, false],
    ["Downtown Counter 1", "DT1", "downtown", staffUsers[1]!.id, -4, false],
    ["Downtown Counter 2", "DT2", "downtown", null, -25, false],
    ["Cebu Main Counter", "CB1", "cebu", staffUsers[2]!.id, -2, false],
    ["Cebu Bar", "CB2", "cebu", staffUsers[7]!.id, -90, false],
    ["Makati Legacy Till", "MK1", "makati", null, -2_000, true],
    ["Training Terminal", "TR1", "uptown", null, -240, false],
  ] as const;
  const deviceSeeds: Array<[string, string, string, string | null, number, boolean]> = [
    ...baseDeviceSeeds,
    ...Array.from({ length: 81 }, (_, index) => {
      const number = index + 1;
      return [
        `${stores[(index + 3) % stores.length]!.name} Counter ${String(number).padStart(2, "0")}`,
        `D${String(number).padStart(2, "0")}`,
        stores[(index + 3) % stores.length]!.key,
        index % 4 === 0 ? staffUsers[(index + 12) % staffUsers.length]!.id : null,
        -(index * 17 + 6),
        index % 29 === 28,
      ];
    }),
  ];
  await scopedDb
    .insertInto("Device")
    .values(
      deviceSeeds.map(([name, code, storeKey, assignedUserId, minutesAgo, revoked]) => ({
        id: seedId("device", code),
        tenant_id: tenantId,
        store_id: stores.find((store) => store.key === storeKey)!.id,
        name,
        code,
        token_hash: seedId("device-token", code),
        enrolled_at: dateAt(-10_000),
        last_seen_at: dateAt(minutesAgo),
        revoked_at: revoked ? dateAt(-1_000) : null,
        assigned_user_id: assignedUserId,
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  await scopedDb
    .insertInto("Category")
    .values(
      categories.map((category) => ({
        id: category.id,
        tenant_id: tenantId,
        name: category.name,
        sort_order: category.sortOrder,
        archived_at: category.name === "Desserts" ? dateAt(-100) : null,
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  await scopedDb
    .insertInto("MenuItem")
    .values(
      menuItems.map(([categoryName, name, priceCentavos], index) => ({
        id: seedId("menu-item", name),
        tenant_id: tenantId,
        category_id: seedId("category", categoryName),
        name,
        price_centavos: priceCentavos,
        sort_order: index,
        archived_at: name === "Seasonal fruit bowl" ? dateAt(-100) : null,
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  const baseVariants = [
    ["House latte", "Hot", 0],
    ["House latte", "Iced", 1000],
    ["House latte", "Large", 3500],
    ["Spanish latte", "Hot", 0],
    ["Spanish latte", "Iced", 1000],
    ["Pancake stack", "Banana", 2500],
    ["Pancake stack", "Berries", 4500],
  ] as const;
  const variants: Array<[string, string, number]> = [
    ...baseVariants,
    ...Array.from({ length: 133 }, (_, index) => {
      const item = menuItems[(index + 4) % menuItems.length]!;
      return [item[1], ["Regular", "Iced", "Large", "Family"][index % 4]!, (index % 4) * 1_500];
    }),
  ];
  await scopedDb
    .insertInto("Variant")
    .values(
      variants.map(([itemName, name, priceDelta], index) => ({
        id: seedId("variant", `${itemName}:${name}`),
        tenant_id: tenantId,
        menu_item_id: seedId("menu-item", itemName),
        name,
        price_centavos:
          menuItems.find(([, menuItemName]) => menuItemName === itemName)![2] + priceDelta,
        sort_order: index,
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  const modifierGroups = [
    { key: "milk", name: "Milk choice", rule: "required-one", maximum: null },
    { key: "syrup", name: "Extra syrup", rule: "many", maximum: 2 },
    { key: "sides", name: "Breakfast sides", rule: "optional-one", maximum: null },
    ...Array.from({ length: 57 }, (_, index) => ({
      key: `custom-${String(index + 1).padStart(2, "0")}`,
      name: `${["Add-ons", "Toppings", "Extras", "Choices"][index % 4]} ${String(index + 1).padStart(2, "0")}`,
      rule: index % 3 === 0 ? "required-one" : index % 3 === 1 ? "optional-one" : "many",
      maximum: index % 3 === 2 ? 2 : null,
    })),
  ];
  await scopedDb
    .insertInto("ModifierGroup")
    .values(
      modifierGroups.map((group, index) => ({
        id: seedId("modifier-group", group.key),
        tenant_id: tenantId,
        name: group.name,
        selection_rule: group.rule,
        maximum: group.maximum,
        sort_order: index,
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  const baseModifiers = [
    ["milk", "Whole milk", "absolute", 0],
    ["milk", "Oat milk", "absolute", 2500],
    ["milk", "Soy milk", "absolute", 1500],
    ["syrup", "Vanilla", "absolute", 1000],
    ["syrup", "Caramel", "absolute", 1000],
    ["syrup", "Hazelnut", "absolute", 1200],
    ["sides", "Garlic rice", "absolute", 3500],
    ["sides", "Atchara", "absolute", 1500],
  ] as const;
  const modifiers: Array<[string, string, string, number]> = [
    ...baseModifiers,
    ...Array.from({ length: 152 }, (_, index) => {
      const group = modifierGroups[(index + 3) % modifierGroups.length]!;
      return [
        group.key,
        `${["Standard", "Premium", "Light", "Double"][index % 4]} ${String(index + 1).padStart(3, "0")}`,
        "absolute",
        500 + (index % 6) * 500,
      ];
    }),
  ];
  await scopedDb
    .insertInto("Modifier")
    .values(
      modifiers.map(([groupKey, name, deltaKind, deltaValue], index) => ({
        id: seedId("modifier", `${groupKey}:${name}`),
        tenant_id: tenantId,
        group_id: seedId("modifier-group", groupKey),
        name,
        delta_kind: deltaKind,
        delta_value: deltaValue,
        sort_order: index,
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
  await scopedDb
    .updateTable("ModifierGroup")
    .set({ default_modifier_id: seedId("modifier", "milk:Whole milk") })
    .where("id", "=", seedId("modifier-group", "milk"))
    .execute();
  const baseModifierLinks = ["House latte", "Spanish latte", "Pancake stack", "Longsilog"].flatMap(
    (itemName) =>
      (itemName === "Pancake stack" || itemName === "Longsilog"
        ? ["sides"]
        : ["milk", "syrup"]
      ).map((groupKey) => [itemName, groupKey] as const),
  );
  const modifierLinks: Array<[string, string]> = [
    ...baseModifierLinks,
    ...Array.from({ length: 152 }, (_, index) => [
      menuItems[(index + 8) % menuItems.length]![1],
      modifierGroups[(index + 3) % modifierGroups.length]!.key,
    ]),
  ];
  await scopedDb
    .insertInto("MenuItemModifierGroup")
    .values(
      modifierLinks.map(([itemName, groupKey]) => ({
        id: seedId("menu-item-modifier-group", `${itemName}:${groupKey}`),
        tenant_id: tenantId,
        menu_item_id: seedId("menu-item", itemName),
        modifier_group_id: seedId("modifier-group", groupKey),
      })),
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
});

console.log(`Seeded DeanPOS Demo Cafe. Admin: ${admin.email} / ${password}`);
console.log(`Tenant ID: ${tenantId}`);
console.log(`Employees: ${staffUsers.length + 1}; stores: ${stores.length}; devices: 90`);

await db.destroy();
