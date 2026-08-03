import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { consumeEnrolmentCode } from "../db-operations/commands/consume-enrolment-code.command.ts";
import { insertDevice } from "../db-operations/commands/insert-device.command.ts";
import { findEnrolmentCodeBySecret } from "../db-operations/queries/find-enrolment-code-by-secret.query.ts";
import { normalizeEnrolmentSecret } from "../short-code.ts";
import { generateDeviceToken, hashDeviceToken } from "../token.ts";
import { getStore } from "../../store/db-operations/queries/get-store.query.ts";

export const inputSchema = z.object({ secret: z.string().min(1) });
type EnrolInput = z.infer<typeof inputSchema>;
type EnrolResult =
  | {
      ok: true;
      token: string;
      deviceId: string;
      name: string;
      code: string;
      storeId: string;
      storeName: string;
    }
  | { ok: false };

// Unauthenticated (issue 09, record 056 Q4/Q6). One message covers expired,
// consumed, and unknown alike — distinguishing them is an enumeration oracle.
// Consuming the code and inserting the Device share one tenant-scoped
// transaction; a unique-violation on (tenant, store, code) rolls both back.
// This exchange writes no audit row — its actor is a terminal, not a User
// (record 056 Q1).
export const handler: Handler<EnrolInput, EnrolResult> = async ({ ctx, input }) => {
  const secret = normalizeEnrolmentSecret(input.secret);

  const enrolmentCode = await findEnrolmentCodeBySecret(ctx.db, secret);
  if (!enrolmentCode) return { ok: false };
  if (enrolmentCode.consumed_at) return { ok: false };
  if (enrolmentCode.expires_at.getTime() < Date.now()) return { ok: false };

  const token = generateDeviceToken();
  const tokenHash = hashDeviceToken(token);
  const deviceId = randomUUID();

  try {
    const inserted = await withTenantScope(ctx.db, enrolmentCode.tenant_id, async (scopedDb) => {
      const consumed = await consumeEnrolmentCode(scopedDb, enrolmentCode.id, deviceId);
      if (!consumed) return null;

      const device = await insertDevice(scopedDb, {
        id: deviceId,
        tenantId: enrolmentCode.tenant_id,
        storeId: enrolmentCode.store_id,
        name: enrolmentCode.name,
        code: enrolmentCode.code,
        tokenHash,
      });
      const store = await getStore(scopedDb, enrolmentCode.store_id);
      return { device, storeName: store?.name ?? "" };
    });
    if (!inserted) return { ok: false };

    return {
      ok: true,
      token,
      deviceId: inserted.device.id,
      name: inserted.device.name,
      code: inserted.device.code,
      storeId: inserted.device.store_id,
      storeName: inserted.storeName,
    };
  } catch {
    // The code's already-consumed by a concurrent exchange, or the Device
    // unique index (tenant, store, code) rejected a reissue — either way,
    // the caller sees the same one refusal.
    return { ok: false };
  }
};
