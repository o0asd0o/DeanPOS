import { useState } from "react";
import { cn, Input } from "ui";

import { PAYMENT_METHOD_NAME_PRESETS } from "./helpers.ts";

const LISTBOX_ID = "payment-method-name-suggestions";

// A free-text field with suggestions, not a Select — the presets seed the
// field, they do not constrain it (record 054 §"Smaller calls" 5). Replaces
// `<datalist>`, whose panel the browser draws in its own chrome.
export function PaymentMethodNameField({
  name,
  value,
  onChange,
  onBlur,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const typed = value.trim().toLowerCase();
  const matches = PAYMENT_METHOD_NAME_PRESETS.filter(
    (preset) => preset.toLowerCase().includes(typed) && preset.toLowerCase() !== typed,
  );
  const showing = open && matches.length > 0;

  function pick(preset: string) {
    onChange(preset);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="payment-method-name">Name</label>
      <div className="relative">
        <Input
          id="payment-method-name"
          name={name}
          placeholder="GCash"
          required
          autoFocus
          autoComplete="off"
          role="combobox"
          aria-expanded={showing}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={
            showing && active >= 0 ? `${LISTBOX_ID}-${String(active)}` : undefined
          }
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            onBlur();
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!showing) {
                setOpen(true);
                setActive(0);
                return;
              }
              setActive((index) =>
                event.key === "ArrowDown"
                  ? (index + 1) % matches.length
                  : (index <= 0 ? matches.length : index) - 1,
              );
            } else if (event.key === "Enter" && showing && active >= 0) {
              event.preventDefault();
              pick(matches[active]);
            } else if (event.key === "Escape" && showing) {
              event.preventDefault();
              setOpen(false);
            }
          }}
        />
        {showing && (
          <ul
            id={LISTBOX_ID}
            role="listbox"
            className="absolute top-full right-0 left-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-input bg-popover p-1 text-popover-foreground shadow-md"
          >
            {matches.map((preset, index) => (
              <li
                key={preset}
                id={`${LISTBOX_ID}-${String(index)}`}
                role="option"
                aria-selected={index === active}
                className={cn(
                  "cursor-default rounded-lg px-3 py-2 text-sm",
                  index === active && "bg-accent text-accent-foreground",
                )}
                // The input's blur would close the panel before a click lands.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(preset)}
              >
                {preset}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
