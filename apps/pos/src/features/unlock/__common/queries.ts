import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

import { readDeviceIdentity } from "@/lib/device-token.ts";
import type { PinRoster } from "@/lib/pin-roster.ts";
import { readPinRoster, writePinRoster } from "@/lib/pin-roster.ts";

// Pulled on mount (record 057 Q3). A successful pull replaces the whole
// local copy atomically. The cache is used only on a transport failure, and
// only when it matches this enrolled Device — never on an explicit refusal
// (`null`, e.g. a revoked token), which must show the blocked screen, and
// never for a different Store's cached roster after a re-enrolment.
export function usePinRoster(): PinRoster | null {
  const { orpc } = useRouteContext({ from: "/" });
  const query = useQuery(orpc.terminal.pinSync.queryOptions());
  const identity = readDeviceIdentity();

  useEffect(() => {
    if (!query.data || !identity || query.data.storeId !== identity.storeId) return;
    writePinRoster({
      storeId: query.data.storeId,
      syncedAt: query.data.syncedAt,
      users: query.data.users,
    });
  }, [query.data, identity]);

  if (query.data) {
    if (!identity || query.data.storeId !== identity.storeId) return null;
    return { storeId: query.data.storeId, syncedAt: query.data.syncedAt, users: query.data.users };
  }
  if (!query.isError) return null;

  const cached = readPinRoster();
  if (!cached || !identity || cached.storeId !== identity.storeId) return null;
  return cached;
}
