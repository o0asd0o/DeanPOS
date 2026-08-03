import { MutationCache, QueryClient, type QueryClientConfig } from "@tanstack/react-query";
import { toast } from "sonner";

// Every mutation reports its outcome, from the cache rather than from the
// call site — a new mutation is loud by default, and `meta` only swaps the
// copy. There is no opt-out on purpose: silence is the bug this prevents.
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { success?: string; error?: string };
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

export function createQueryClient(config?: QueryClientConfig): QueryClient {
  return new QueryClient({
    ...config,
    mutationCache: new MutationCache({
      onSuccess: (data, _variables, _context, mutation) => {
        if (isRefusal(data)) toast.error(mutation.meta?.error ?? DEFAULT_ERROR);
        else toast.success(mutation.meta?.success ?? DEFAULT_SUCCESS);
      },
      onError: (_error, _variables, _context, mutation) => {
        toast.error(mutation.meta?.error ?? DEFAULT_ERROR);
      },
    }),
  });
}
