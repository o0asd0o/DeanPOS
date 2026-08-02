import { findUserById } from "backend/src/auth/db-operations/queries/find-user-by-id.query.ts";
import { findSessionById } from "backend/src/auth/db-operations/queries/find-session-by-id.query.ts";
import { touchSession } from "backend/src/auth/db-operations/commands/touch-session.command.ts";
import { SESSION_IDLE_TTL_MS } from "backend/src/auth/session-policy.ts";
import type { Ctx, PlatformAdminPrincipal, Principal } from "backend/src/common/ctx.ts";
import { withTenantScope } from "backend/src/db/client.ts";
import type { DatabaseInstance } from "backend/src/db/client.ts";

/** Test-seam-only path: fixes a whole app instance to one explicit principal (apps/api/src/test-seam.ts). Production never calls this. */
export const createContext = (
  db: DatabaseInstance,
  principal: Principal | null = null,
  platformAdmin: PlatformAdminPrincipal | null = null,
): Ctx => {
  if (principal && platformAdmin) {
    throw new Error("Ctx cannot carry both a tenant principal and a platform-admin principal");
  }
  if (principal) return { db, kind: "tenant", principal };
  if (platformAdmin) return { db, kind: "platform-admin", platformAdmin };
  return { db, kind: "unauthenticated" };
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
): Promise<Ctx> => {
  if (!sessionId) return { db, kind: "unauthenticated" };

  const session = await findSessionById(db, sessionId);
  if (!session || session.revoked_at) return { db, kind: "unauthenticated" };

  const now = Date.now();
  if (session.expires_at.getTime() < now) return { db, kind: "unauthenticated" };
  if (now - session.last_seen_at.getTime() > SESSION_IDLE_TTL_MS)
    return { db, kind: "unauthenticated" };

  return withTenantScope(db, session.tenant_id, async (scopedDb) => {
    await touchSession(scopedDb, sessionId);
    const user = await findUserById(scopedDb, session.user_id);
    if (!user || !user.active) return { db, kind: "unauthenticated" };

    return {
      db,
      kind: "tenant",
      principal: {
        tenantId: session.tenant_id,
        userId: user.id,
        sessionId,
        mustChangePassword: user.must_change_password,
      },
    };
  });
};
