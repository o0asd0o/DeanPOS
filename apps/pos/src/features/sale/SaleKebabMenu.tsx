import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Button,
} from "ui";

import { LockButton } from "@/components/LockButton.tsx";
import { useOptionalActingUser } from "@/lib/acting-user.tsx";

type Props = { disabled: boolean; onClear: () => void };

export function SaleKebabMenu({ disabled, onClear }: Props) {
  const actingUser = useOptionalActingUser();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="More actions">
          ⋮
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actingUser && (
          <DropdownMenuItem asChild>
            <LockButton />
          </DropdownMenuItem>
        )}
        <DropdownMenuItem disabled={disabled} onSelect={onClear}>
          Clear order
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
