import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as createUserHandler } from "backend/src/user/handlers/create-user.ts";
import { handler as deactivateUserHandler } from "backend/src/user/handlers/deactivate-user.ts";
import { handler as listUsersHandler } from "backend/src/user/handlers/list-users.ts";
import { handler as reactivateUserHandler } from "backend/src/user/handlers/reactivate-user.ts";
import { handler as resetUserPasswordHandler } from "backend/src/user/handlers/reset-user-password.ts";
import { handler as updateUserHandler } from "backend/src/user/handlers/update-user.ts";
import { contract } from "contract/src/index.ts";

// Only transport-aware code for `user.*` (ADR-0008 rule 5).
const os = implement(contract).$context<Ctx>();

export const userListRoute = os.user.list.handler(({ context }) =>
  listUsersHandler({ ctx: context, input: undefined }),
);
export const userCreateRoute = os.user.create.handler(({ context, input }) =>
  createUserHandler({ ctx: context, input }),
);
export const userUpdateRoute = os.user.update.handler(({ context, input }) =>
  updateUserHandler({ ctx: context, input }),
);
export const userDeactivateRoute = os.user.deactivate.handler(({ context, input }) =>
  deactivateUserHandler({ ctx: context, input }),
);
export const userReactivateRoute = os.user.reactivate.handler(({ context, input }) =>
  reactivateUserHandler({ ctx: context, input }),
);
export const userResetPasswordRoute = os.user.resetPassword.handler(({ context, input }) =>
  resetUserPasswordHandler({ ctx: context, input }),
);
