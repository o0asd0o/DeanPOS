import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

import type { PinRoster } from "@/lib/pin-roster.ts";
import { readPinRoster, writePinRoster } from "@/lib/pin-roster.ts";

// Pulled on mount (record 057 Q3). A successful pull replaces the whole
// local copy atomically; a failed pull with a cached roster is silent —
// the cache is what criterion 4's offline unlock uses.
export function usePinRoster(): PinRoster | null {
  const { orpc } = useRouteContext({ from: "/" });
  const query = useQuery(orpc.terminal.pinSync.queryOptions());

  useEffect(() => {
    if (query.data?.ok) {
      writePinRoster({
        storeId: query.data.storeId,
        syncedAt: query.data.syncedAt,
        users: query.data.users,
      });
    }
  }, [query.data]);

  if (query.data?.ok) {
    return { storeId: query.data.storeId, syncedAt: query.data.syncedAt, users: query.data.users };
  }
  return readPinRoster();
}
