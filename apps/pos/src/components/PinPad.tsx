import type { ReactNode, RefObject } from "react";
import { Button, Input } from "ui";

const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function formatClock(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Extracted verbatim from Unlock.tsx (record 060 Q5): the masked input, the
// twelve-cell keypad and lock strip, shared with the Override prompt.
// `trailing` is the twelfth cell — Unlock's submit button, or empty.
export function PinPad({
  pin,
  onPinChange,
  lockedUntil,
  lockMessage,
  srStatus,
  trailing,
  inputRef,
}: {
  pin: string;
  onPinChange: (next: string) => void;
  lockedUntil: number | null;
  lockMessage: string;
  srStatus: string;
  trailing: ReactNode;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const isLocked = lockedUntil !== null;

  const setPinDigits = (next: string) => {
    if (isLocked) return;
    onPinChange(next.replace(/\D/g, "").slice(0, 6));
  };

  return (
    <>
      <p role="status" className="sr-only">
        {srStatus}
      </p>

      <Input
        ref={inputRef}
        type="password"
        inputMode="none"
        autoComplete="off"
        spellCheck={false}
        aria-label="PIN"
        readOnly={isLocked}
        className="text-center text-2xl tracking-widest"
        value={pin}
        onChange={(event) => setPinDigits(event.target.value)}
      />

      <div className="grid grid-cols-3 gap-2">
        {KEYPAD_DIGITS.map((digit) => (
          <Button
            key={digit}
            type="button"
            variant="outline"
            aria-disabled={isLocked}
            onClick={() => setPinDigits(pin + digit)}
          >
            {digit}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          aria-label="Backspace"
          aria-disabled={pin.length === 0 || isLocked}
          onClick={() => {
            if (pin.length === 0 || isLocked) return;
            setPinDigits(pin.slice(0, -1));
          }}
        >
          <span aria-hidden="true">⌫</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-disabled={isLocked}
          onClick={() => setPinDigits(pin + "0")}
        >
          0
        </Button>
        {trailing}
      </div>

      {isLocked && lockedUntil !== null && (
        <p className="w-full rounded-xl border border-dashed border-destructive/60 px-4 py-3 text-center text-sm text-destructive">
          {lockMessage} {formatClock(lockedUntil - Date.now())}
        </p>
      )}
    </>
  );
}
