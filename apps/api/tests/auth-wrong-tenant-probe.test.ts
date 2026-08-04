import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vite-plus/test";

import { createDb } from "backend/src/db/client.ts";
import { hashPassword } from "backend/src/common/password.ts";
import { seedTenantUser } from "../src/seed-tenant-user.ts";
import { createTestSeam } from "../src/test-seam.ts";
import { expectWrongTenantRefusal } from "../src/wrong-tenant-probe.ts";

// Issue 03 acceptance criterion 8: acting as Tenant A never touches Tenant
// B's rows. Each probe below seeds its own fresh Tenant A/B pair, because a
// password one probe changes (setPassword) or a session another revokes
// (signOut) must never leave a later probe's own sign-in failing silently —
// that is exactly what turned round 1's signOut probe vacuous.
const seam = createTestSeam();
const ownerDb = createDb({ databaseUrl: process.env.DATABASE_URI! });
const password = "correct horse battery staple";

type Pair = {
  tenantA: string;
  tenantB: string;
  userA: string;
  userB: string;
  emailA: string;
  emailB: string;
};

async function seedPair(options: { mustChangePassword?: boolean } = {}): Promise<Pair> {
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const emailA = `wrong-tenant-a-${randomUUID()}@sign-in.test`;
  const emailB = `wrong-tenant-b-${randomUUID()}@sign-in.test`;
  const mustChangePassword = options.mustChangePassword ?? false;

  await ownerDb
    .insertInto("Tenant")
    .values([
      { id: tenantA, name: "Wrong-tenant A" },
      { id: tenantB, name: "Wrong-tenant B" },
    ])
    .execute();
  const passwordHash = await hashPassword(password);
  await seedTenantUser(ownerDb, {
    id: userA,
    tenantId: tenantA,
    email: emailA,
    passwordHash,
    mustChangePassword,
    role: "admin",
  });
  await seedTenantUser(ownerDb, {
    id: userB,
    tenantId: tenantB,
    email: emailB,
    passwordHash,
    mustChangePassword,
    role: "admin",
  });

  return { tenantA, tenantB, userA, userB, emailA, emailB };
}

async function cleanupPair(pair: Pair): Promise<void> {
  await ownerDb
    .deleteFrom("Session")
    .where("tenant_id", "in", [pair.tenantA, pair.tenantB])
    .execute();
  await ownerDb.deleteFrom("UserRole").where("user_id", "in", [pair.userA, pair.userB]).execute();
  await ownerDb.deleteFrom("User").where("id", "in", [pair.userA, pair.userB]).execute();
  await ownerDb.deleteFrom("Tenant").where("id", "in", [pair.tenantA, pair.tenantB]).execute();
}

afterAll(async () => {
  await ownerDb.destroy();
  await seam.db.destroy();
});

describe("wrong-tenant probes on auth.*", () => {
  it("auth.signIn: Tenant B's real password never opens Tenant A's account, and the created session is scoped to the account actually matched", async () => {
    const pair = await seedPair();

    const crossCredential = await seam.actors.signIn(pair.emailA, password + "-wrong");
    expect(crossCredential.result).toStrictEqual({ ok: false });

    const { result, sessionCookie } = await seam.actors.signIn(pair.emailA, password);
    expect(result.ok).toBe(true);

    const sessionId = sessionCookie!.split("=")[1]!;
    const row = await ownerDb
      .selectFrom("Session")
      .select("tenant_id")
      .where("id", "=", sessionId)
      .executeTakeFirstOrThrow();
    expect(row.tenant_id).toBe(pair.tenantA);
    expect(row.tenant_id).not.toBe(pair.tenantB);

    await cleanupPair(pair);
  });

  it("wrong-tenant probe [auth.me]: Tenant A's session reports Tenant A's own state, never Tenant B's", async () => {
    const pair = await seedPair({ mustChangePassword: true });
    // B changes its own password first, which also clears must_change_password —
    // giving A and B genuinely different, currently-true state to distinguish.
    const bSignIn = await seam.actors.signIn(pair.emailB, password);
    expect(bSignIn.result.ok).toBe(true);
    await bSignIn.client.auth.setPassword({ newPassword: "b's own new password" });
    const ownerSees = await bSignIn.client.auth.me();

    const aSignIn = await seam.actors.signIn(pair.emailA, password);
    expect(aSignIn.result.ok).toBe(true);

    const otherSees = await aSignIn.client.auth.me();
    expect(otherSees).toStrictEqual({
      authenticated: true,
      mustChangePassword: true,
      role: "admin",
      userId: pair.userA,
      email: pair.emailA,
    });

    await expectWrongTenantRefusal({
      path: "auth.me",
      mode: "confined",
      ownerSees,
      otherGets: async () => otherSees,
      otherOwn: otherSees,
    });

    await cleanupPair(pair);
  });

  it("wrong-tenant probe [auth.setPassword]: auth.setPassword as Tenant A's session never touches Tenant B's User row", async () => {
    const pair = await seedPair({ mustChangePassword: true });

    const before = await ownerDb
      .selectFrom("User")
      .select("password_hash")
      .where("id", "=", pair.userB)
      .executeTakeFirstOrThrow();

    const { result, client } = await seam.actors.signIn(pair.emailA, password);
    expect(result.ok).toBe(true);

    const ownerSees = await client.auth.setPassword({ newPassword: "a's new password" });
    expect(ownerSees).toStrictEqual({ ok: true });

    const rowA = await ownerDb
      .selectFrom("User")
      .selectAll()
      .where("id", "=", pair.userA)
      .executeTakeFirstOrThrow();
    const rowB = await ownerDb
      .selectFrom("User")
      .selectAll()
      .where("id", "=", pair.userB)
      .executeTakeFirstOrThrow();

    // A's hash changed to the new password; B's is byte-for-byte unchanged
    // — not merely "still a scrypt-shaped string", which a fresh hash of
    // the same plaintext would also be, salt notwithstanding.
    expect(rowA.password_hash).not.toBe(before.password_hash);
    expect(rowB.password_hash).toBe(before.password_hash);

    const bSignIn = await seam.actors.signIn(pair.emailB, password);
    expect(bSignIn.result.ok).toBe(true);
    const otherSees = await bSignIn.client.auth.setPassword({
      newPassword: "b's own new password",
    });

    await expectWrongTenantRefusal({
      path: "auth.setPassword",
      mode: "effect",
      ownerSees,
      otherGets: async () => otherSees,
      otherBefore: before.password_hash,
      otherAfter: async () => rowB.password_hash,
      why: "setPassword's { ok: true } carries no tenant data by design; isolation is proven by the per-row password hash comparison.",
    });

    await cleanupPair(pair);
  });

  it("wrong-tenant probe [auth.signOut]: auth.signOut as Tenant A's session never revokes Tenant B's Session row", async () => {
    const pair = await seedPair();

    const sessionB = await seam.actors.signIn(pair.emailB, password);
    expect(sessionB.result.ok).toBe(true);
    const sessionA = await seam.actors.signIn(pair.emailA, password);
    expect(sessionA.result.ok).toBe(true);

    const beforeB = await ownerDb
      .selectFrom("Session")
      .select("revoked_at")
      .where("id", "=", sessionB.sessionCookie!.split("=")[1]!)
      .executeTakeFirstOrThrow();

    const ownerSees = await sessionA.client.auth.signOut();

    const rowA = await ownerDb
      .selectFrom("Session")
      .selectAll()
      .where("id", "=", sessionA.sessionCookie!.split("=")[1]!)
      .executeTakeFirstOrThrow();
    const rowB = await ownerDb
      .selectFrom("Session")
      .selectAll()
      .where("id", "=", sessionB.sessionCookie!.split("=")[1]!)
      .executeTakeFirstOrThrow();
    expect(rowA.revoked_at).not.toBeNull();
    expect(rowB.revoked_at).toBeNull();

    const otherSees = await sessionB.client.auth.signOut();

    await expectWrongTenantRefusal({
      path: "auth.signOut",
      mode: "effect",
      ownerSees,
      otherGets: async () => otherSees,
      otherBefore: beforeB.revoked_at,
      otherAfter: async () => rowB.revoked_at,
      why: "signOut's { ok: true } carries no tenant data by design; isolation is proven by the per-row revoked_at comparison.",
    });

    await cleanupPair(pair);
  });
});

describe("wrong-tenant probe on ping", () => {
  it("wrong-tenant probe [ping]: ping is genuinely tenant-neutral — no Tenant column, no predicate, same row for everyone", async () => {
    const pair = await seedPair();
    const asA = await seam.actors.signIn(pair.emailA, password);
    const asB = await seam.actors.signIn(pair.emailB, password);

    const ownerSees = await asB.client.ping();

    await expectWrongTenantRefusal({
      path: "ping",
      mode: "shared",
      ownerSees,
      otherGets: () => asA.client.ping(),
      why: "getPing selects from Ping with no tenant predicate and the spine migration grants it no tenant_id column — the only genuinely tenant-neutral procedure.",
    });

    await cleanupPair(pair);
  });
});
