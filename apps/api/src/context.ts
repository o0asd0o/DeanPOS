import { findUserById } from "backend/src/auth/db-operations/queries/find-user-by-id.query.ts";
import { findSessionById } from "backend/src/auth/db-operations/queries/find-session-by-id.query.ts";
import { touchSession } from "backend/src/auth/db-operations/commands/touch-session.command.ts";
import { SESSION_IDLE_TTL_MS } from "backend/src/auth/session-policy.ts";
import { getRoleAsOf } from "backend/src/access/db-operations/queries/get-role-as-of.query.ts";
import type { Ctx, PlatformAdminPrincipal, Principal } from "backend/src/common/ctx.ts";
import { withTenantScope } from "backend/src/db/client.ts";
import type { DatabaseInstance } from "backend/src/db/client.ts";

/** Test-seam-only path: fixes a whole app instance to one explicit principal (apps/api/src/test-seam.ts). Production never calls this. */
export const createContext = (
  db: DatabaseInstance,
  clientIp: string,
  principal: Principal | null = null,
  platformAdmin: PlatformAdminPrincipal | null = null,
): Ctx => {
  if (principal && platformAdmin) {
    throw new Error("Ctx cannot carry both a tenant principal and a platform-admin principal");
  }
  if (principal) return { db, clientIp, kind: "tenant", principal };
  if (platformAdmin) return { db, clientIp, kind: "platform-admin", platformAdmin };
  return { db, clientIp, kind: "unauthenticated" };
};

/**
 * Production path (issue 03): builds Ctx per request from the session
 * cookie. A missing, unknown, revoked, or expired (idle or absolute)
 * session — or a deactivated User — all resolve to `unauthenticated`,
 * never a distinguishable error (mirrors sign-in's own refusal shape).
 */
export const buildContextFromSession = async (
  db: DatabaseInstance,
  sessionId: string | null,
  clientIp: string,
): Promise<Ctx> => {
  if (!sessionId) return { db, clientIp, kind: "unauthenticated" };

  const session = await findSessionById(db, sessionId);
  if (!session || session.revoked_at) return { db, clientIp, kind: "unauthenticated" };

  const now = Date.now();
  if (session.expires_at.getTime() < now) return { db, clientIp, kind: "unauthenticated" };
  if (now - session.last_seen_at.getTime() > SESSION_IDLE_TTL_MS)
    return { db, clientIp, kind: "unauthenticated" };

  return withTenantScope(db, session.tenant_id, async (scopedDb) => {
    await touchSession(scopedDb, sessionId);
    const user = await findUserById(scopedDb, session.user_id);
    if (!user || !user.active) return { db, clientIp, kind: "unauthenticated" };

    // The live gate authorises from UserRole, never the User.role
    // convenience copy — absence is a refusal, not a default (issue 04,
    // round 1 finding 1). `User.role` is not read here at all.
    const currentRole = await getRoleAsOf(scopedDb, user.id, new Date());
    if (!currentRole) return { db, clientIp, kind: "unauthenticated" };

    return {
      db,
      clientIp,
      kind: "tenant",
      principal: {
        tenantId: session.tenant_id,
        userId: user.id,
        email: user.email,
        sessionId,
        mustChangePassword: user.must_change_password,
        role: currentRole.role,
      },
    };
  });
};
