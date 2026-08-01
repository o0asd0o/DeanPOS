import type { Ctx } from "./ctx.ts";

/** The shape every handler file exports (ADR-0008 rule 1): transport-pure, `{ ctx, input }` in, data out. */
export type Handler<TInput, TOutput> = (args: { ctx: Ctx; input: TInput }) => Promise<TOutput>;
