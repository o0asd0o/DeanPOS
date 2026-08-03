import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "ui";

import { verifyPin } from "contract/src/pin.ts";

import { useActingUser } from "@/lib/acting-user.tsx";
import { readDeviceIdentity } from "@/lib/device-token.ts";
import { usePinRoster } from "./__common/queries.ts";

const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

// The unlock screen (issue 10, record 057 Q4). Unlock is always local —
// there is no online unlock path (Q1) — verified against the last synced
// roster (usePinRoster).
export function Unlock() {
  const roster = usePinRoster();
  const identity = readDeviceIdentity();
  const { setActingUser } = useActingUser();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const selectedUser = roster?.users.find((user) => user.userId === selectedId) ?? null;
  const setPinDigits = (next: string) => setPin(next.replace(/\D/g, "").slice(0, 6));

  const handleSelect = (userId: string) => {
    setSelectedId(userId);
    setPin("");
    setError(null);
    pinInputRef.current?.focus();
  };

  const canUnlock = selectedUser !== null && selectedUser.pinHash !== null && pin.length >= 4;

  const handleUnlock = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canUnlock || !selectedUser || pending) return;

    setPending(true);
    setError(null);
    const ok = await verifyPin(pin, selectedUser.pinHash!);
    setPending(false);

    if (!ok) {
      setPin("");
      setError("That PIN is not correct");
      return;
    }
    setActingUser({ userId: selectedUser.userId, displayName: selectedUser.displayName });
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{identity ? `${identity.storeName} · ${identity.name}` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!roster || roster.users.length === 0 ? (
            <p role="status">
              No one is set up at this till yet. Connect once to load the store&rsquo;s users
            </p>
          ) : (
            <>
              <span id="who-is-on-the-till" className="sr-only">
                Who is on the till
              </span>
              <div
                role="group"
                aria-labelledby="who-is-on-the-till"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {roster.users.map((user) => (
                  <Button
                    key={user.userId}
                    type="button"
                    variant="outline"
                    aria-pressed={user.userId === selectedId}
                    onClick={() => handleSelect(user.userId)}
                  >
                    {user.displayName}
                  </Button>
                ))}
              </div>

              <form onSubmit={handleUnlock} className="flex flex-col gap-4">
                <Input
                  ref={pinInputRef}
                  type="password"
                  inputMode="none"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="PIN"
                  className="text-center text-2xl tracking-widest"
                  value={pin}
                  onChange={(event) => setPinDigits(event.target.value)}
                />

                {selectedUser && selectedUser.pinHash === null && (
                  <p role="alert">
                    {selectedUser.displayName} has no PIN yet. They set one in the back office, from
                    their account menu
                  </p>
                )}
                {error && <p role="alert">{error}</p>}

                <div className="grid grid-cols-3 gap-2">
                  {KEYPAD_DIGITS.map((digit) => (
                    <Button
                      key={digit}
                      type="button"
                      variant="outline"
                      onClick={() => setPinDigits(pin + digit)}
                    >
                      {digit}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Backspace"
                    aria-disabled={pin.length === 0}
                    onClick={() => {
                      if (pin.length === 0) return;
                      setPinDigits(pin.slice(0, -1));
                    }}
                  >
                    <span aria-hidden="true">⌫</span>
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setPinDigits(pin + "0")}>
                    0
                  </Button>
                  <Button type="submit" aria-disabled={!canUnlock || pending}>
                    {pending ? "Unlocking…" : "Unlock"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
