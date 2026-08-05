import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  cleanup as unmountAll,
  createDb,
  expectNoAxeViolations,
  fireEvent,
  hashPassword,
  renderRoute,
  screen,
  waitFor,
  within,
} from "api/src/test-seam-react.tsx";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";

import { formatCentavos, parsePriceInput } from "@/features/catalog/helpers.ts";
import { router } from "@/router.tsx";

const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const tenantId = randomUUID();
const adminId = randomUUID();
const storeId = randomUUID();
const categoryId = randomUUID();
const menuItemId = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Menu Item Editor Tenant" })
    .execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: adminId,
      tenant_id: tenantId,
      email: `mie-${randomUUID()}@test.local`,
      password_hash: await hashPassword("irrelevant"),
      role: "admin",
    })
    .execute();
  await ownerDb
    .insertInto("Store")
    .values({ id: storeId, tenant_id: tenantId, name: "Editor Store" })
    .execute();
  await ownerDb
    .insertInto("Category")
    .values({
      id: categoryId,
      tenant_id: tenantId,
      name: "Ulam",
      sort_order: 0,
    })
    .execute();
  await ownerDb
    .insertInto("MenuItem")
    .values({
      id: menuItemId,
      tenant_id: tenantId,
      category_id: categoryId,
      name: "Adobo",
      sort_order: 0,
    })
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("Variant").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("MenuItem").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Category").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Store").where("id", "=", storeId).execute();
  await ownerDb.deleteFrom("User").where("id", "=", adminId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("catalog money helpers (scenario 14 bounds)", () => {
  it("accepts ₱1,200.00 after stripping the sign and commas", () => {
    const result = parsePriceInput("₱1,200.00");
    expect(result).toStrictEqual({ ok: true, value: 120_000 });
    expect(formatCentavos(120_000)).toBe("₱1,200.00");
  });

  it("rejects 120.505 (more than two decimal places)", () => {
    expect(parsePriceInput("120.505")).toStrictEqual({
      ok: false,
      error: "invalid-format",
    });
  });

  it("rejects 1e3 scientific notation", () => {
    expect(parsePriceInput("1e3")).toStrictEqual({
      ok: false,
      error: "invalid-format",
    });
  });
});

describe("one money formatter on catalog surfaces", () => {
  it("grep-proves catalog features use formatCentavos only", () => {
    const root = join(process.cwd(), "src/features/catalog");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|jsx?)$/.test(name)) files.push(path);
      }
    };
    walk(root);

    const banned = [
      /toLocaleString\s*\(/,
      /Intl\.NumberFormat/,
      /formatMoney/,
      /formatPeso/,
      /centavosToPesosString/,
    ];
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const pattern of banned) {
        if (pattern.test(source)) offenders.push(`${file}: ${pattern}`);
      }
      // A second inline ₱ formatter (template with division by 100) outside formatCentavos.
      if (
        !file.endsWith("helpers.ts") &&
        /₱\$\{/.test(source) &&
        !source.includes("formatCentavos")
      ) {
        offenders.push(`${file}: inline peso template`);
      }
    }
    expect(offenders).toStrictEqual([]);
    expect(files.some((file) => file.endsWith("helpers.ts"))).toBe(true);
    expect(readFileSync(join(root, "helpers.ts"), "utf8")).toMatch(/export\b.*\bformatCentavos\b/);
  });
});

describe("the MenuItem editor route", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    unmountAll();
    await cleanup?.();
    cleanup = undefined;
  });

  it(
    "loads the full-page editor, validates price bounds, creates a variant, and passes axe",
    { timeout: 20_000 },
    async () => {
      const { container, db } = renderRoute({
        router,
        tenantId,
        userId: adminId,
        role: "admin",
        initialLocation: `/catalog/${menuItemId}`,
      });
      cleanup = () => db.destroy();

      await waitFor(() => expect(screen.getByRole("heading", { name: "Adobo" })).toBeTruthy());
      await waitFor(() => expect(screen.getByRole("heading", { name: "Variants" })).toBeTruthy());
      expect(screen.getByText(/No variants yet/i)).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: /Add variant/i }));
      await waitFor(() =>
        expect(screen.getByRole("heading", { name: "New variant" })).toBeTruthy(),
      );

      const price = screen.getByLabelText("Price");
      expect(price.getAttribute("inputMode") || (price as HTMLInputElement).inputMode).toMatch(
        /decimal/,
      );
      expect((price as HTMLInputElement).type).not.toBe("number");

      const variantName = document.getElementById("variant-name") as HTMLInputElement;
      expect(variantName).toBeTruthy();
      fireEvent.change(variantName, { target: { value: "Regular" } });
      fireEvent.change(price, { target: { value: "1e3" } });
      fireEvent.click(
        within(screen.getByRole("heading", { name: "New variant" }).closest("form")!).getByRole(
          "button",
          { name: /^Save$/ },
        ),
      );
      await waitFor(() =>
        expect(screen.getByRole("alert").textContent).toMatch(/pesos and centavos/i),
      );

      fireEvent.change(price, { target: { value: "120.505" } });
      fireEvent.click(
        within(screen.getByRole("heading", { name: "New variant" }).closest("form")!).getByRole(
          "button",
          { name: /^Save$/ },
        ),
      );
      await waitFor(() =>
        expect(screen.getByRole("alert").textContent).toMatch(/pesos and centavos/i),
      );

      fireEvent.change(price, { target: { value: "₱1,200.00" } });
      fireEvent.click(
        within(screen.getByRole("heading", { name: "New variant" }).closest("form")!).getByRole(
          "button",
          { name: /^Save$/ },
        ),
      );

      await waitFor(() =>
        expect(screen.queryByRole("heading", { name: "New variant" })).toBeNull(),
      );
      await waitFor(() => expect(screen.getByText("Regular")).toBeTruthy());
      expect(screen.getByText("₱1,200.00")).toBeTruthy();

      // Ends disabled on single-row reorder.
      expect(
        (screen.getByRole("button", { name: /Move variant Regular up/i }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(
        (screen.getByRole("button", { name: /Move variant Regular down/i }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);

      await expectNoAxeViolations(container);
    },
  );

  it("archives a variant from the editor", { timeout: 15_000 }, async () => {
    const seedId = randomUUID();
    await ownerDb
      .insertInto("Variant")
      .values({
        id: seedId,
        tenant_id: tenantId,
        menu_item_id: menuItemId,
        name: "To Archive",
        price_centavos: 5_000,
        sort_order: 10,
      })
      .execute();

    const { db } = renderRoute({
      router,
      tenantId,
      userId: adminId,
      role: "admin",
      initialLocation: `/catalog/${menuItemId}`,
    });
    cleanup = () => db.destroy();

    await waitFor(() => expect(screen.getByText("To Archive")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Archive variant To Archive/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Archive To Archive/i })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Archive$/ }));
    await waitFor(() => expect(screen.getByText("Archived")).toBeTruthy());
  });
});
