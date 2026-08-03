import { WandSparklesIcon } from "lucide-react";
import { Button, PasswordInput } from "ui";

import { Hint } from "@/components/Hint.tsx";
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
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id}>{label}</label>
      <Hint
        id={`${id}-hint`}
        detail={`At least 8 characters. Any characters, including spaces — there are no other rules.${
          detail ? ` ${detail}` : ""
        }`}
      >
        At least 8 characters.
      </Hint>
      <div className="flex items-center gap-2">
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
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => onChange(generateTemporaryPassword())}
        >
          <WandSparklesIcon />
          Generate
        </Button>
      </div>
    </div>
  );
}
