import { createHash } from "node:crypto";

import { hashPassword } from "../packages/backend/src/common/password.ts";
import { createDb, sql, withTenantScope } from "../packages/backend/src/db/client.ts";
import type { Role } from "../packages/backend/src/db/prisma/generated/types.ts";

const databaseUrl = process.env.DATABASE_URI;
if (!databaseUrl) {
  throw new Error("DATABASE_URI is required. Load .env before running seed:demo.");
}

const password = "DemoPass123!";
const db = createDb({ databaseUrl });

const seedId = (kind: string, value: string): string => {
  const hex = createHash("sha256")
    .update(`deanpos-demo:${kind}:${value}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
};

const baseDate = new Date("2026-08-01T08:00:00.000Z");
const dateAt = (minutes: number) => new Date(baseDate.getTime() + minutes * 60_000);

const tenantSeeds = [
  { key: "nanays-kusina", name: "Nanay's Kusina" },
  { key: "kusina-ni-rosa", name: "Kusina ni Rosa" },
] as const;

const storeSeeds = [
  {
    tenantKey: "nanays-kusina",
    key: "marikina",
    name: "Marikina Main",
    labels: ["T1", "T2", "T3", "T4"],
  },
  {
    tenantKey: "nanays-kusina",
    key: "antipolo",
    name: "Antipolo Branch",
    labels: ["T1", "T2", "T3"],
  },
  {
    tenantKey: "kusina-ni-rosa",
    key: "sampaloc",
    name: "Sampaloc Main",
    labels: ["T1", "T2", "T3", "T4"],
  },
  {
    tenantKey: "kusina-ni-rosa",
    key: "quiapo",
    name: "Quiapo Branch",
    labels: ["T1", "T2", "T3"],
  },
] as const;

const menuItemSeeds = [
  ["Ulam", "Chicken adobo", 13500],
  ["Ulam", "Pork menudo", 13000],
  ["Ulam", "Bistek Tagalog", 15500],
  ["Ulam", "Giniling na baboy", 12000],
  ["Ulam", "Pritong galunggong", 10500],
  ["Ulam", "Ginisang monggo", 9500],
  ["Ulam", "Pinakbet", 10000],
  ["Ulam", "Laing", 10000],
  ["Ihaw", "Pork barbecue", 4500],
  ["Ihaw", "Grilled liempo", 14500],
  ["Ihaw", "Chicken inasal", 13000],
  ["Sinigang at Sabaw", "Sinigang na baboy", 15000],
  ["Sinigang at Sabaw", "Nilagang baka", 16500],
  ["Kanin at Sides", "Steamed rice", 2500],
  ["Kanin at Sides", "Garlic rice", 3500],
  ["Kanin at Sides", "Lumpiang shanghai", 3000],
  ["Meryenda", "Pancit bihon", 7500],
  ["Meryenda", "Turon", 2500],
  ["Drinks", "Sago't gulaman", 3500],
  ["Drinks", "Iced tea", 3000],
] as const;

const paymentMethodSeeds = [
  { key: "gcash", name: "GCash", kind: "recorded" as const },
  { key: "cash", name: "Cash", kind: "cash" as const },
  { key: "paymaya", name: "PayMaya", kind: "recorded" as const },
] as const;

const roleSeeds: Array<{
  key: string;
  firstName: string;
  lastName: string;
  role: Role;
  storeKey?: string;
}> = [
  { key: "admin", firstName: "Mila", lastName: "Santos", role: "admin" },
  { key: "manager", firstName: "Ramon", lastName: "Cruz", role: "manager" },
  {
    key: "cashier-marikina-1",
    firstName: "Aira",
    lastName: "Reyes",
    role: "cashier",
    storeKey: "marikina",
  },
  {
    key: "cashier-marikina-2",
    firstName: "Jomar",
    lastName: "Garcia",
    role: "cashier",
    storeKey: "marikina",
  },
  {
    key: "cashier-marikina-3",
    firstName: "Lani",
    lastName: "Flores",
    role: "cashier",
    storeKey: "marikina",
  },
  {
    key: "cashier-antipolo-1",
    firstName: "Paolo",
    lastName: "Ramos",
    role: "cashier",
    storeKey: "antipolo",
  },
  {
    key: "cashier-antipolo-2",
    firstName: "Cathy",
    lastName: "Lim",
    role: "cashier",
    storeKey: "antipolo",
  },
  {
    key: "cashier-antipolo-3",
    firstName: "Noel",
    lastName: "Tan",
    role: "cashier",
    storeKey: "antipolo",
  },
  {
    key: "cashier-antipolo-4",
    firstName: "Bea",
    lastName: "Torres",
    role: "cashier",
    storeKey: "antipolo",
  },
];

const resetDatabase = async () => {
  await sql`TRUNCATE TABLE "Tenant" CASCADE`.execute(db);
  await sql`TRUNCATE TABLE "PlatformAdmin" CASCADE`.execute(db);
  await sql`TRUNCATE TABLE "SignInThrottle"`.execute(db);
  await sql`TRUNCATE TABLE "Ping"`.execute(db);
};

const seedTenant = async (tenant: (typeof tenantSeeds)[number], passwordHash: string) => {
  const tenantId = seedId("tenant", tenant.key);
  const stores = storeSeeds
    .filter((store) => store.tenantKey === tenant.key)
    .map((store) => ({
      ...store,
      id: seedId("store", `${tenant.key}:${store.key}`),
    }));
  const users = roleSeeds.map((user) => ({
    ...user,
    id: seedId("user", `${tenant.key}:${user.key}`),
    email: `${user.key}.${tenant.key}@deanpos.local`,
  }));

  await withTenantScope(db, tenantId, async (scopedDb) => {
    await scopedDb
      .insertInto("Tenant")
      .values({ id: tenantId, name: tenant.name, timezone: "Asia/Manila" })
      .execute();
    await scopedDb
      .insertInto("Store")
      .values(
        stores.map((store) => ({
          id: store.id,
          tenant_id: tenantId,
          name: store.name,
          active: true,
          table_labels: [...store.labels],
          business_day_start: "06:00",
        })),
      )
      .execute();
    await scopedDb
      .insertInto("User")
      .values(
        users.map((user) => ({
          id: user.id,
          tenant_id: tenantId,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          password_hash: passwordHash,
          role: user.role,
          active: true,
          must_change_password: false,
        })),
      )
      .execute();
    await scopedDb
      .insertInto("UserRole")
      .values(
        users.map((user, index) => ({
          id: seedId("user-role", user.id),
          tenant_id: tenantId,
          user_id: user.id,
          role: user.role,
          effective_from: dateAt(index),
        })),
      )
      .execute();

    const userStoreRows = users.flatMap((user, index) => {
      const assignedStores =
        user.role === "cashier" ? stores.filter((store) => store.key === user.storeKey) : stores;
      return assignedStores.map((store, storeIndex) => ({
        id: seedId("user-store", `${user.id}:${store.id}`),
        tenant_id: tenantId,
        user_id: user.id,
        store_id: store.id,
        assigned: true,
        effective_from: dateAt(index * 10 + storeIndex),
      }));
    });
    await scopedDb.insertInto("UserStore").values(userStoreRows).execute();

    await scopedDb
      .insertInto("PaymentMethod")
      .values(
        paymentMethodSeeds.map((method) => ({
          id: seedId("payment-method", `${tenant.key}:${method.key}`),
          tenant_id: tenantId,
          name: method.name,
          kind: method.kind,
        })),
      )
      .execute();
    await scopedDb
      .insertInto("PaymentMethodAvailability")
      .values(
        paymentMethodSeeds
          .filter((method) => method.kind === "recorded")
          .flatMap((method) =>
            stores.map((store) => ({
              id: seedId("payment-availability", `${tenant.key}:${method.key}:${store.key}`),
              tenant_id: tenantId,
              payment_method_id: seedId("payment-method", `${tenant.key}:${method.key}`),
              store_id: store.id,
            })),
          ),
      )
      .onConflict((oc) => oc.columns(["payment_method_id", "store_id"]).doNothing())
      .execute();

    const categories = [...new Set(menuItemSeeds.map(([category]) => category))].map(
      (name, index) => ({
        id: seedId("category", `${tenant.key}:${name}`),
        name,
        sortOrder: index,
      }),
    );
    await scopedDb
      .insertInto("Category")
      .values(
        categories.map((category) => ({
          id: category.id,
          tenant_id: tenantId,
          name: category.name,
          sort_order: category.sortOrder,
          archived_at: null,
        })),
      )
      .execute();
    await scopedDb
      .insertInto("MenuItem")
      .values(
        menuItemSeeds.map(([categoryName, name, priceCentavos], index) => ({
          id: seedId("menu-item", `${tenant.key}:${name}`),
          tenant_id: tenantId,
          category_id: categories.find((category) => category.name === categoryName)!.id,
          name,
          price_centavos: priceCentavos,
          sort_order: index,
          archived_at: null,
        })),
      )
      .execute();

    const variants = [
      ["Chicken adobo", "Regular", 13500],
      ["Chicken adobo", "Half serving", 7500],
      ["Pork menudo", "Regular", 13000],
      ["Pork menudo", "Half serving", 7000],
    ] as const;
    await scopedDb
      .insertInto("Variant")
      .values(
        variants.map(([itemName, name, priceCentavos], index) => ({
          id: seedId("variant", `${tenant.key}:${itemName}:${name}`),
          tenant_id: tenantId,
          menu_item_id: seedId("menu-item", `${tenant.key}:${itemName}`),
          name,
          price_centavos: priceCentavos,
          sort_order: index,
          archived_at: null,
        })),
      )
      .execute();

    const modifierGroups = [
      { key: "rice", name: "Rice choice", rule: "optional-one", maximum: null },
      {
        key: "spice",
        name: "Spice level",
        rule: "optional-one",
        maximum: null,
      },
    ] as const;
    const modifiers = [
      ["rice", "Steamed rice", 0],
      ["rice", "Garlic rice", 1000],
      ["spice", "Regular", 0],
      ["spice", "Spicy", 0],
    ] as const;
    await scopedDb
      .insertInto("ModifierGroup")
      .values(
        modifierGroups.map((group, index) => ({
          id: seedId("modifier-group", `${tenant.key}:${group.key}`),
          tenant_id: tenantId,
          name: group.name,
          selection_rule: group.rule,
          maximum: group.maximum,
          sort_order: index,
          archived_at: null,
        })),
      )
      .execute();
    await scopedDb
      .insertInto("Modifier")
      .values(
        modifiers.map(([groupKey, name, deltaValue], index) => ({
          id: seedId("modifier", `${tenant.key}:${groupKey}:${name}`),
          tenant_id: tenantId,
          group_id: seedId("modifier-group", `${tenant.key}:${groupKey}`),
          name,
          delta_kind: "absolute",
          delta_value: deltaValue,
          sort_order: index,
          archived_at: null,
        })),
      )
      .execute();
    await scopedDb
      .updateTable("ModifierGroup")
      .set({
        default_modifier_id: seedId("modifier", `${tenant.key}:rice:Steamed rice`),
      })
      .where("id", "=", seedId("modifier-group", `${tenant.key}:rice`))
      .execute();
    const modifierLinks = [
      ["Chicken adobo", "rice"],
      ["Pork menudo", "rice"],
      ["Bistek Tagalog", "rice"],
      ["Sinigang na baboy", "spice"],
    ] as const;
    await scopedDb
      .insertInto("MenuItemModifierGroup")
      .values(
        modifierLinks.map(([itemName, groupKey]) => ({
          id: seedId("menu-item-modifier-group", `${tenant.key}:${itemName}:${groupKey}`),
          tenant_id: tenantId,
          menu_item_id: seedId("menu-item", `${tenant.key}:${itemName}`),
          modifier_group_id: seedId("modifier-group", `${tenant.key}:${groupKey}`),
        })),
      )
      .execute();

    const addOns = [
      { key: "extra-rice", name: "Extra rice", deltaValue: 2500, maximum: 2 },
      { key: "fried-egg", name: "Fried egg", deltaValue: 2500, maximum: 1 },
      { key: "atchara", name: "Atchara", deltaValue: 1500, maximum: 1 },
    ] as const;
    await scopedDb
      .insertInto("AddOn")
      .values(
        addOns.map((addOn, index) => ({
          id: seedId("add-on", `${tenant.key}:${addOn.key}`),
          tenant_id: tenantId,
          name: addOn.name,
          delta_kind: "absolute",
          delta_value: addOn.deltaValue,
          maximum: addOn.maximum,
          sort_order: index,
          archived_at: null,
        })),
      )
      .execute();
    const addOnLinks = [
      ["Chicken adobo", "extra-rice"],
      ["Pork menudo", "extra-rice"],
      ["Bistek Tagalog", "fried-egg"],
      ["Pork barbecue", "atchara"],
    ] as const;
    await scopedDb
      .insertInto("MenuItemAddOn")
      .values(
        addOnLinks.map(([itemName, addOnKey]) => ({
          id: seedId("menu-item-add-on", `${tenant.key}:${itemName}:${addOnKey}`),
          tenant_id: tenantId,
          menu_item_id: seedId("menu-item", `${tenant.key}:${itemName}`),
          add_on_id: seedId("add-on", `${tenant.key}:${addOnKey}`),
        })),
      )
      .execute();

    await scopedDb
      .insertInto("Device")
      .values(
        stores.map((store, index) => ({
          id: seedId("device", `${tenant.key}:${store.key}`),
          tenant_id: tenantId,
          store_id: store.id,
          name: `${store.name} Counter`,
          code: `${tenant.key === "nanays-kusina" ? "NK" : "KR"}${index + 1}`,
          token_hash: seedId("device-token", `${tenant.key}:${store.key}`),
          enrolled_at: dateAt(-1_440),
          last_seen_at: dateAt(-index * 10),
          revoked_at: null,
          assigned_user_id: users.find((user) => user.role === "manager")!.id,
        })),
      )
      .execute();
  });

  return { tenantId, admin: users.find((user) => user.role === "admin")! };
};

try {
  await resetDatabase();
  const passwordHash = await hashPassword(password);
  const seededTenants = await Promise.all(
    tenantSeeds.map((tenant) => seedTenant(tenant, passwordHash)),
  );

  console.log("Reset database and seeded 2 carinderia tenants.");
  console.log(
    "Each tenant: 2 stores, 3 payment methods, 20 menu items, 1 admin, 1 manager, and 7 cashiers.",
  );
  for (const tenant of seededTenants) {
    console.log(`${tenant.admin.email} / ${password} (${tenant.tenantId})`);
  }
} finally {
  await db.destroy();
}
