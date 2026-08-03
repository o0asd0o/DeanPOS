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

// Physical columns to the contract's camelCase shape (issue 01). `storeIds`
// is the handler's visibility-projected set, never off the row (044 §2.3).
export const toUserOutput = (user: Selectable<User>, storeIds: string[]): UserOutput => ({
  id: user.id,
  tenantId: user.tenant_id,
  email: user.email,
  role: user.role,
  active: user.active,
  createdAt: user.createdAt,
  storeIds,
});
