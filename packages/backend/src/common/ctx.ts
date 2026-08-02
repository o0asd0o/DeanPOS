import type { DatabaseInstance } from "../db/client.ts";

// The tenant is read from here and nowhere else — never a header, a query,
// a body, or the hostname (issue 01). The other fields arrive with a real
// session (issue 03) and are optional because `asTenant(tenantId)` omits them.
export type Principal = {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  mustChangePassword?: boolean;
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

// `resHeaders` is oRPC's ResponseHeadersPlugin injection (issue 03): the
// sign-in/sign-out routes append `Set-Cookie` to it. Absent outside a real
// HTTP request (e.g. the test seam's direct handler calls).
export type Ctx = { db: DatabaseInstance; resHeaders?: Headers } & Identity;
