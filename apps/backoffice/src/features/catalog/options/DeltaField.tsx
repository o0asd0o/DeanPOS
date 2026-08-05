import { cn, Input } from "ui";

import { MoneyInput } from "@/components/MoneyInput.tsx";

export type DeltaKind = "absolute" | "multiplier";

/**
 * Two radios for Delta kind — never a Select (Direction prohibition 2).
 * Affix on the value field flips with the radio while the number is typed.
 */
export function DeltaField({
  kind,
  value,
  onKindChange,
  onValueChange,
  error,
}: {
  kind: DeltaKind;
  value: string;
  onKindChange: (kind: DeltaKind) => void;
  onValueChange: (value: string) => void;
  error?: string | null;
}) {
  const valueId = "modifier-delta-value";

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1">Price adjustment</legend>
      <div className="flex gap-2" role="radiogroup" aria-label="Adjustment type">
        {(["absolute", "multiplier"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => onKindChange(k)}
            className={cn(
              "flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
              kind === k
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-card text-foreground hover:bg-accent",
            )}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                kind === k ? "border-primary" : "border-muted-foreground",
              )}
            >
              {kind === k && <span className="size-2 rounded-full bg-primary" />}
            </span>
            {k === "absolute" ? "Absolute amount" : "Multiplier"}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={valueId}>{kind === "absolute" ? "Amount (Additional)" : "Rate"}</label>
        {kind === "absolute" ? (
          <MoneyInput
            id={valueId}
            name="delta-amount"
            value={value}
            onChange={onValueChange}
            aria-invalid={error ? true : undefined}
          />
        ) : (
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground"
            >
              ×
            </span>
            <Input
              id={valueId}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "delta-value-error" : undefined}
              className="pl-8 tabular-nums"
            />
          </div>
        )}
        {error ? (
          <p id="delta-value-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
