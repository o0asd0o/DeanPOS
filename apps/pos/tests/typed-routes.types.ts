import type { LinkProps } from "@tanstack/react-router";

import "../src/router.tsx";

// If this directive ever becomes UNUSED, `to` has stopped being a typed union and
// the "a link to a removed route fails the build" criterion has silently
// regressed. The gate then goes red, which is the direction we want it to fail in.
// @ts-expect-error - "/__no-such-route" is not a registered route path
export const brokenLink: LinkProps = { to: "/__no-such-route" };
