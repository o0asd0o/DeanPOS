import type { DatabaseInstance } from "../db/client.ts";

// The tenant is read from here and nowhere else — never a header, a query
// parameter, a request body, or the hostname (issue 01, tenant-isolation-spine).
export type Principal = { tenantId: string };

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

export type Ctx = { db: DatabaseInstance } & Identity;
