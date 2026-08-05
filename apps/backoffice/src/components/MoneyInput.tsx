import { useCallback, useState } from "react";
import { Input } from "ui";

import { centavosToEditorString, parsePriceInput } from "@/features/catalog/helpers.ts";

/**
 * Peso-prefixed input that formats with commas on blur and strips them on focus.
 * Stores a plain decimal string (no ₱, no commas) as the field value.
 */
export function MoneyInput({
  id,
  name,
  value,
  onBlur,
  onChange,
  placeholder = "120.00",
  required,
  "aria-invalid": ariaInvalid,
}: {
  id: string;
  name: string;
  value: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  "aria-invalid"?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  const formatted = useCallback((raw: string) => {
    const parsed = parsePriceInput(raw);
    if (!parsed.ok) return raw;
    return centavosToEditorString(parsed.value).replace(/\d+/, (match) =>
      Number(match).toLocaleString("en-PH"),
    );
  }, []);

  const display = focused ? value : formatted(value);

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
      >
        ₱
      </span>
      <Input
        id={id}
        name={name}
        inputMode="decimal"
        placeholder={placeholder}
        required={required}
        aria-invalid={ariaInvalid}
        className="pl-8"
        value={display}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        onChange={(event) => {
          const stripped = event.target.value.replace(/,/g, "");
          onChange(stripped);
        }}
      />
    </div>
  );
}
