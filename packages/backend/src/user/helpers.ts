import type { User } from "../db/prisma/generated/types.ts";

type UserOutput = {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: User["role"];
  active: boolean;
  createdAt: Date;
  storeIds: string[];
};

// Only the columns this shape needs — never the full row, so a caller
// selecting an explicit column list (never selectAll on User, issue 10)
// still satisfies this without pulling password_hash or pin_hash along.
type UserRow = {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: User["role"];
  active: boolean;
  createdAt: Date;
};

// Physical columns to the contract's camelCase shape (issue 01). `storeIds`
// is the handler's visibility-projected set, never off the row (044 §2.3).
export const toUserOutput = (user: UserRow, storeIds: string[]): UserOutput => ({
  id: user.id,
  tenantId: user.tenant_id,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  role: user.role,
  active: user.active,
  createdAt: user.createdAt,
  storeIds,
});
