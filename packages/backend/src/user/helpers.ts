import type { Selectable } from "kysely";

import type { User } from "../db/prisma/generated/types.ts";

type UserOutput = {
  id: string;
  tenantId: string;
  email: string;
  role: User["role"];
  active: boolean;
  createdAt: Date;
  storeIds: string[];
};

// Physical `@map`ped columns to the contract's camelCase shape (issue 01,
// findings on the tenant_id rename). Every User handler routes through this.
// `storeIds` never comes off the row — it is the caller-visibility-projected
// assignment set the handler computed separately (record 044 §2 clause 3).
export const toUserOutput = (user: Selectable<User>, storeIds: string[]): UserOutput => ({
  id: user.id,
  tenantId: user.tenant_id,
  email: user.email,
  role: user.role,
  active: user.active,
  createdAt: user.createdAt,
  storeIds,
});
