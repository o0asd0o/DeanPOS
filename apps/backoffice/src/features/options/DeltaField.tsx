import { Input } from "ui";

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
  const affix = kind === "absolute" ? "+₱" : "×";
  const valueId = "modifier-delta-value";

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Price adjustment</legend>
      <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Adjustment type">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="delta-kind"
            value="absolute"
            checked={kind === "absolute"}
            onChange={() => onKindChange("absolute")}
          />
          Absolute amount
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="delta-kind"
            value="multiplier"
            checked={kind === "multiplier"}
            onChange={() => onKindChange("multiplier")}
          />
          Multiplier
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={valueId}>{kind === "absolute" ? "Amount" : "Rate"}</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums" aria-hidden="true">
            {affix}
          </span>
          <Input
            id={valueId}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "delta-value-error" : undefined}
            className="tabular-nums"
          />
        </div>
        {error ? (
          <p id="delta-value-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
