import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { client } from "../src/lib/orpc.ts";

// The API sits on a different subdomain, so the default fetch credentials
// mode ("same-origin") makes the browser discard the session Set-Cookie —
// the round-1 defect that let all 236 server-side tests stay green while
// sign-in was broken end to end. See .scratch/tenancy-identity/issues/03.
describe("orpc client credentials", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests with credentials: include", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));

    await client.ping().catch(() => undefined);

    expect(fetchSpy).toHaveBeenCalled();
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.credentials).toBe("include");
  });
});
