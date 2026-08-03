import { randomUUID } from "node:crypto";

import { z } from "zod";

import { hasAtLeastRole } from "../../common/authorize.ts";
import type { Handler } from "../../common/handler.ts";
import { withTenantScope } from "../../db/client.ts";
import { getStore } from "../../store/db-operations/queries/get-store.query.ts";
import { insertDeviceAudit } from "../db-operations/commands/insert-device-audit.command.ts";
import { insertEnrolmentCode } from "../db-operations/commands/insert-enrolment-code.command.ts";
import { isCodeReserved } from "../db-operations/queries/is-code-reserved.query.ts";
import { ENROLMENT_CODE_TTL_MS } from "../device-policy.ts";
import {
  DEVICE_CODE_PATTERN,
  generateEnrolmentSecret,
  normalizeDeviceCode,
} from "../short-code.ts";

export const inputSchema = z.object({
  storeId: z.string(),
  name: z.string().min(1),
  code: z.string().regex(DEVICE_CODE_PATTERN),
});

type GenerateCodeInput = z.infer<typeof inputSchema>;
type GenerateCodeResult =
  | { ok: true; secret: string; name: string; code: string; storeId: string; expiresAt: Date }
  | { ok: false };

// `admin` only (issue 09 acceptance criteria). Writes one `code_generated`
// audit row against the EnrolmentCode subject — never against a Device,
// which does not exist yet (record 056 Q1).
export const handler: Handler<GenerateCodeInput, GenerateCodeResult> = async ({ ctx, input }) => {
  if (ctx.kind !== "tenant" || !ctx.principal.userId || !ctx.principal.role) return { ok: false };
  const { tenantId, userId, role } = ctx.principal;
  if (!hasAtLeastRole(role, "admin")) return { ok: false };

  const code = normalizeDeviceCode(input.code);
  if (!DEVICE_CODE_PATTERN.test(code)) return { ok: false };

  return withTenantScope(ctx.db, tenantId, async (scopedDb) => {
    // Scoped to the caller's Tenant — a wrong-tenant storeId reads as
    // not-found here instead of tripping the composite FK on insert.
    if (!(await getStore(scopedDb, input.storeId))) return { ok: false };
    if (await isCodeReserved(scopedDb, input.storeId, code)) return { ok: false };

    const secret = generateEnrolmentSecret();
    const expiresAt = new Date(Date.now() + ENROLMENT_CODE_TTL_MS);

    const enrolmentCode = await insertEnrolmentCode(scopedDb, {
      id: randomUUID(),
      tenantId,
      storeId: input.storeId,
      name: input.name,
      code,
      secret,
      expiresAt,
    });

    await insertDeviceAudit(scopedDb, {
      id: randomUUID(),
      tenantId,
      actorUserId: userId,
      deviceId: null,
      enrolmentCodeId: enrolmentCode.id,
      field: "code_generated",
      oldValue: null,
      newValue: code,
    });

    return { ok: true, secret, name: input.name, code, storeId: input.storeId, expiresAt };
  });
};
