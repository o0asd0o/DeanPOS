import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as changePasswordHandler } from "backend/src/auth/handlers/change-password.ts";
import { handler as meHandler } from "backend/src/auth/handlers/me.ts";
import { handler as setPasswordHandler } from "backend/src/auth/handlers/set-password.ts";
import { handler as signInHandler } from "backend/src/auth/handlers/sign-in.ts";
import { handler as signOutHandler } from "backend/src/auth/handlers/sign-out.ts";
import { contract } from "contract/src/index.ts";

import { buildExpiredSessionCookie, buildSessionCookie } from "../cookies.ts";

// Only transport-aware code for `auth.*` (ADR-0008 rule 5): turns a
// successful sign-in/sign-out into a Set-Cookie header. `appDomain` is
// closed over rather than added to `Ctx`, which carries identity, not config.
export const createAuthRoutes = (appDomain: string, dev = false) => {
  const builder = implement(contract).$context<Ctx>();

  const signInRoute = builder.auth.signIn.handler(async ({ context, input }) => {
    const result = await signInHandler({ ctx: context, input });

    if (result.ok) {
      context.resHeaders?.append(
        "Set-Cookie",
        buildSessionCookie(appDomain, result.sessionId, result.expiresAt, dev),
      );
      return { ok: true, mustChangePassword: result.mustChangePassword };
    }

    return { ok: false };
  });

  const signOutRoute = builder.auth.signOut.handler(async ({ context }) => {
    const result = await signOutHandler({ ctx: context, input: undefined });
    context.resHeaders?.append("Set-Cookie", buildExpiredSessionCookie(appDomain, dev));
    return result;
  });

  const setPasswordRoute = builder.auth.setPassword.handler(({ context, input }) =>
    setPasswordHandler({ ctx: context, input }),
  );

  const changePasswordRoute = builder.auth.changePassword.handler(({ context, input }) =>
    changePasswordHandler({ ctx: context, input }),
  );

  const meRoute = builder.auth.me.handler(({ context }) =>
    meHandler({ ctx: context, input: undefined }),
  );

  return {
    signIn: signInRoute,
    signOut: signOutRoute,
    setPassword: setPasswordRoute,
    changePassword: changePasswordRoute,
    me: meRoute,
  };
};
