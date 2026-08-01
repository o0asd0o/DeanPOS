import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { contract } from "contract/src/index.ts";

// @ts-expect-error — a router missing a contract procedure must not typecheck (.scratch/decisions/006).
implement(contract).$context<Ctx>().router({});
