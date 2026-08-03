import { PasswordInput } from "ui";

import { InfoTooltip } from "@/components/InfoTooltip.tsx";
import { generateTemporaryPassword } from "./helpers.ts";

// One field, one reveal, no clipboard and no second surface — record 043's
// rules, plus record 051's generator, which fills this same field rather than
// producing the value anywhere else.
export function TemporaryPasswordField({
  id,
  name,
  value,
  onChange,
  onBlur,
  label,
  detail,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  label: string;
  detail?: string;
}) {
  const guidance = `At least 8 characters. Any characters, including spaces — there are no other rules.${
    detail ? ` ${detail}` : ""
  }`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label htmlFor={id}>{label}</label>
        <InfoTooltip>{guidance}</InfoTooltip>
        <span id={`${id}-hint`} className="sr-only">
          {guidance}
        </span>
        <button
          type="button"
          className="ml-auto text-sm underline underline-offset-4"
          onClick={() => onChange(generateTemporaryPassword())}
        >
          Generate
        </button>
      </div>
      <PasswordInput
        id={id}
        name={name}
        autoComplete="new-password"
        required
        minLength={8}
        aria-describedby={`${id}-hint`}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
