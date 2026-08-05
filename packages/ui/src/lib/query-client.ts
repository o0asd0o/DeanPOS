import { MutationCache, QueryClient, type QueryClientConfig } from "@tanstack/react-query";
import { toast } from "sonner";

// Every mutation reports its outcome, from the cache rather than from the
// call site — a new mutation is loud by default, and `meta` only swaps the
// copy. `silent: true` is the deliberate opt-out for screens that announce
// through record 038's live regions instead (catalog Options, Direction §5).
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { success?: string; error?: string; silent?: boolean };
  }
}

const DEFAULT_SUCCESS = "Saved";
const DEFAULT_ERROR = "Something went wrong";

// A handler that refuses resolves `null` (or `{ ok: false }`) rather than
// rejecting, so a settled promise is not a success by itself.
function isRefusal(data: unknown): boolean {
  return (
    data === null ||
    data === undefined ||
    (typeof data === "object" && "ok" in data && data.ok === false)
  );
}

// Route guards `fetchQuery(auth.me)` before rendering, and at the library
// default every query is stale on arrival — so each navigation blocked on a
// fresh round trip. Mutations invalidate what they change, so this window
// only ever delays a change made in another tab.
const DEFAULT_STALE_TIME_MS = 30_000;

export function createQueryClient(config?: QueryClientConfig): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config?.defaultOptions,
      queries: { staleTime: DEFAULT_STALE_TIME_MS, ...config?.defaultOptions?.queries },
    },
    mutationCache: new MutationCache({
      onSuccess: (data, _variables, _context, mutation) => {
        if (mutation.meta?.silent) return;
        if (isRefusal(data)) toast.error(mutation.meta?.error ?? DEFAULT_ERROR);
        else toast.success(mutation.meta?.success ?? DEFAULT_SUCCESS);
      },
      onError: (_error, _variables, _context, mutation) => {
        if (mutation.meta?.silent) return;
        toast.error(mutation.meta?.error ?? DEFAULT_ERROR);
      },
    }),
  });
}
