import type { Selectable } from "kysely";

import type { Device } from "../db/prisma/generated/types.ts";

type DeviceOutput = {
  id: string;
  tenantId: string;
  storeId: string;
  name: string;
  code: string;
  enrolledAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
};

// Physical `@map`ped columns to the contract's camelCase shape (issue 01's
// convention). `tokenHash` never leaves this module (record 056 Q2).
export const toDeviceOutput = (device: Selectable<Device>): DeviceOutput => ({
  id: device.id,
  tenantId: device.tenant_id,
  storeId: device.store_id,
  name: device.name,
  code: device.code,
  enrolledAt: device.enrolled_at,
  lastSeenAt: device.last_seen_at,
  revokedAt: device.revoked_at,
});
