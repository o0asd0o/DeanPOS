import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { cn } from "../lib/utils.ts";
import { Input } from "./input.tsx";

// The reveal button is keyboard-operable (SC 2.1.1, Level A) — record 043.
function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "children">) {
  const [revealed, setRevealed] = React.useState(false);
  const Icon = revealed ? EyeOffIcon : EyeIcon;

  return (
    <div className="relative">
      <Input {...props} type={revealed ? "text" : "password"} className={cn("pr-10", className)} />
      <button
        type="button"
        aria-label={revealed ? "Hide password" : "Show password"}
        aria-pressed={revealed}
        onClick={() => setRevealed((current) => !current)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export { PasswordInput };
