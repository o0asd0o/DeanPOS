import { findUserById } from "backend/src/auth/db-operations/queries/find-user-by-id.query.ts";
import { findSessionById } from "backend/src/auth/db-operations/queries/find-session-by-id.query.ts";
import { touchSession } from "backend/src/auth/db-operations/commands/touch-session.command.ts";
import { SESSION_IDLE_TTL_MS } from "backend/src/auth/session-policy.ts";
import { getRoleAsOf } from "backend/src/access/db-operations/queries/get-role-as-of.query.ts";
import type {
  Ctx,
  DevicePrincipal,
  PlatformAdminPrincipal,
  Principal,
} from "backend/src/common/ctx.ts";
import { withTenantScope } from "backend/src/db/client.ts";
import type { DatabaseInstance } from "backend/src/db/client.ts";
import { touchDevice } from "backend/src/device/db-operations/commands/touch-device.command.ts";
import { findDeviceByTokenHash } from "backend/src/device/db-operations/queries/find-device-by-token-hash.query.ts";
import { hashDeviceToken } from "backend/src/device/token.ts";

/** Test-seam-only path: fixes a whole app instance to one explicit principal (apps/api/src/test-seam.ts). Production never calls this. */
export const createContext = (
  db: DatabaseInstance,
  clientIp: string,
  principal: Principal | null = null,
  platformAdmin: PlatformAdminPrincipal | null = null,
  device: DevicePrincipal | null = null,
): Ctx => {
  const actors = [principal, platformAdmin, device].filter((actor) => actor !== null);
  if (actors.length > 1) {
    throw new Error("Ctx cannot carry more than one of principal/platformAdmin/device");
  }
  if (principal) return { db, clientIp, kind: "tenant", principal };
  if (platformAdmin) return { db, clientIp, kind: "platform-admin", platformAdmin };
  if (device) return { db, clientIp, kind: "device", device };
  return { db, clientIp, kind: "unauthenticated" };
};

/** Production path (issue 03): a missing, unknown, revoked, expired, or
 * deactivated-User session all resolve to `unauthenticated`, never a distinguishable error. */
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
    // convenience copy — absence is a refusal, not a default. `User.role`
    // is not read here at all.
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
        firstName: user.first_name,
        lastName: user.last_name,
        sessionId,
        mustChangePassword: user.must_change_password,
        role: currentRole.role,
      },
    };
  });
};

/** Production path for the Device token (issue 09, record 056 Q6): a missing,
 * unknown, malformed, or revoked Device all resolve to `unauthenticated`. */
export const buildContextFromDeviceToken = async (
  db: DatabaseInstance,
  token: string | null,
  clientIp: string,
): Promise<Ctx> => {
  if (!token) return { db, clientIp, kind: "unauthenticated" };

  const tokenHash = hashDeviceToken(token);
  const device = await findDeviceByTokenHash(db, tokenHash);
  if (!device || device.revoked_at) return { db, clientIp, kind: "unauthenticated" };

  return withTenantScope(db, device.tenant_id, async (scopedDb) => {
    const touched = await touchDevice(scopedDb, device.id);
    if (!touched) return { db, clientIp, kind: "unauthenticated" };
    return {
      db,
      clientIp,
      kind: "device",
      device: {
        tenantId: device.tenant_id,
        deviceId: device.id,
        storeId: device.store_id,
        code: device.code,
        name: device.name,
      },
    };
  });
};
