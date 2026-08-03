import { fireEvent, render, screen } from "api/src/test-seam-react.tsx";
import { describe, expect, it } from "vite-plus/test";

import { ActingUserProvider, useActingUser } from "@/lib/acting-user.tsx";

// The acting User (issue 10, record 057 Q5): in memory only, and Lock is
// `setActingUser(null)` and nothing else.
function Probe() {
  const { actingUser, setActingUser } = useActingUser();
  return (
    <div>
      <p>{actingUser ? actingUser.displayName : "locked"}</p>
      <button onClick={() => setActingUser({ userId: "u1", displayName: "Ana Reyes" })}>
        unlock
      </button>
      <button onClick={() => setActingUser(null)}>lock</button>
    </div>
  );
}

describe("ActingUserProvider", () => {
  it("starts locked, sets on unlock, and clears on lock", () => {
    render(
      <ActingUserProvider>
        <Probe />
      </ActingUserProvider>,
    );

    expect(screen.getByText("locked")).toBeTruthy();
    fireEvent.click(screen.getByText("unlock"));
    expect(screen.getByText("Ana Reyes")).toBeTruthy();
    fireEvent.click(screen.getByText("lock"));
    expect(screen.getByText("locked")).toBeTruthy();
  });

  it("lock never touches deanpos.device.token, deanpos.device.identity, or deanpos.pin.roster", () => {
    localStorage.setItem("deanpos.device.token", "token-value");
    localStorage.setItem("deanpos.device.identity", '{"deviceId":"d1"}');
    localStorage.setItem("deanpos.pin.roster", '{"storeId":"s1","syncedAt":"now","users":[]}');

    render(
      <ActingUserProvider>
        <Probe />
      </ActingUserProvider>,
    );

    fireEvent.click(screen.getByText("unlock"));
    fireEvent.click(screen.getByText("lock"));

    expect(localStorage.getItem("deanpos.device.token")).toBe("token-value");
    expect(localStorage.getItem("deanpos.device.identity")).toBe('{"deviceId":"d1"}');
    expect(localStorage.getItem("deanpos.pin.roster")).toBe(
      '{"storeId":"s1","syncedAt":"now","users":[]}',
    );

    localStorage.clear();
  });

  it("useActingUser throws outside a provider", () => {
    // Suppress React's expected error-boundary console noise for this case.
    const spy = () => {};
    const original = console.error;
    console.error = spy;
    expect(() => render(<Probe />)).toThrow();
    console.error = original;
  });
});
