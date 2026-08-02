import type { DatabaseInstance } from "../db/client.ts";
import type { Role } from "../db/prisma/generated/types.ts";

// The tenant is read from here and nowhere else — never a header, a query,
// a body, or the hostname (issue 01). `role` is resolved fresh per request
// from the effective-dated UserRole history, never User.role (issue 04).
export type Principal = {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  mustChangePassword?: boolean;
  role?: Role;
};

// A platform admin is a distinct principal, never a Tenant's User with a
// special role — no `tenantId`, and no code path derives one from it
// (issue 02, platform-admin-tenant-provisioning).
export type PlatformAdminPrincipal = { platformAdminId: string };

// Built once per app instance, not per request (issue 03 moves this). ADR-0008.
// The three states are mutually exclusive by construction — a Ctx can never
// carry both a tenant and a platform-admin principal (issue 02 review round 1).
type Identity =
  | { kind: "unauthenticated" }
  | { kind: "tenant"; principal: Principal }
  | { kind: "platform-admin"; platformAdmin: PlatformAdminPrincipal };

// `resHeaders` (oRPC's ResponseHeadersPlugin, issue 03) is where sign-in/out
// append `Set-Cookie`; absent outside a real HTTP request. `clientIp`
// (record 033) is for sign-in throttling only — never authorisation.
export type Ctx = { db: DatabaseInstance; resHeaders?: Headers; clientIp: string } & Identity;
