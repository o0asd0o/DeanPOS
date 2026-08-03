import type { DatabaseInstance } from "../db/client.ts";
import type { Role } from "../db/prisma/generated/types.ts";

// The tenant is read from here and nowhere else — never a header, a query,
// a body, or the hostname (issue 01). `role` is resolved fresh per request
// from the effective-dated UserRole history, never User.role (issue 04).
export type Principal = {
  tenantId: string;
  userId?: string;
  email?: string;
  sessionId?: string;
  mustChangePassword?: boolean;
  role?: Role;
};

// A platform admin is a distinct principal, never a Tenant's User with a
// special role — no `tenantId`, and no code path derives one from it
// (issue 02, platform-admin-tenant-provisioning).
export type PlatformAdminPrincipal = { platformAdminId: string };

// The terminal's own principal (issue 09, record 056 Q6). Derived entirely
// from the Device row, never from request input — a Device cannot act for
// another Store.
export type DevicePrincipal = {
  tenantId: string;
  deviceId: string;
  storeId: string;
  code: string;
  name: string;
};

// Built once per app instance, not per request (issue 03 moves this). ADR-0008.
// The four states are mutually exclusive by construction. The Device arm's
// field is `device`, never `principal` (record 056 Q6).
type Identity =
  | { kind: "unauthenticated" }
  | { kind: "tenant"; principal: Principal }
  | { kind: "platform-admin"; platformAdmin: PlatformAdminPrincipal }
  | { kind: "device"; device: DevicePrincipal };

// `resHeaders` (oRPC's ResponseHeadersPlugin, issue 03) is where sign-in/out
// append `Set-Cookie`; absent outside a real HTTP request. `clientIp`
// (record 033) is for sign-in throttling only — never authorisation.
export type Ctx = { db: DatabaseInstance; resHeaders?: Headers; clientIp: string } & Identity;

// A Device handler's own guard (record 056 Q6): narrows to the `device` arm
// or returns null. Reading `ctx.device.storeId` after this cannot compile
// against the tenant arm, and vice versa — the type is the enforcement.
export const deviceCtx = (ctx: Ctx): (Ctx & { kind: "device" }) | null =>
  ctx.kind === "device" ? ctx : null;
