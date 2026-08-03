import { randomUUID } from "node:crypto";

import {
  createDb,
  expectNoAxeViolations,
  hashPassword,
  renderRoute,
  screen,
  waitFor,
} from "api/src/test-seam-react.tsx";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { router } from "@/router.tsx";

// Finding 8, its own file/tenant — record 038 §6 rule already applied to
// this suite: repeated renders of the same route in one file are risky,
// so a manager with zero Store assignments gets its own render.
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });

const tenantId = randomUUID();
const unassignedManagerId = randomUUID();

beforeAll(async () => {
  await ownerDb
    .insertInto("Tenant")
    .values({ id: tenantId, name: "Stores Screen Manager Empty Tenant" })
    .execute();
  await ownerDb
    .insertInto("User")
    .values({
      id: unassignedManagerId,
      tenant_id: tenantId,
      email: `stores-screen-manager-unassigned-${randomUUID()}@store.test`,
      password_hash: await hashPassword("irrelevant"),
      role: "manager",
    })
    .execute();
});

afterAll(async () => {
  await ownerDb.deleteFrom("User").where("tenant_id", "=", tenantId).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "=", tenantId).execute();
  await ownerDb.destroy();
});

describe("the Stores screen — a manager with no assigned Store (finding 8)", () => {
  it("shows an empty state with no 'Add store above' — that control does not exist for them", async () => {
    const { container, db } = renderRoute({
      router,
      tenantId,
      userId: unassignedManagerId,
      role: "manager",
      initialLocation: "/stores",
    });

    await waitFor(() => expect(screen.getByText("No stores yet")).toBeTruthy());
    expect(screen.queryByText(/Add store above/)).toBeNull();
    await expectNoAxeViolations(container);

    await db.destroy();
  });
});
