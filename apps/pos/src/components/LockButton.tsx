import { LockKeyhole } from "lucide-react";
import { Button } from "ui";

import { useActingUser } from "@/lib/acting-user.tsx";

export function LockButton() {
  const { actingUser, setActingUser } = useActingUser();
  if (actingUser === null) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start text-popover-foreground hover:bg-accent hover:text-accent-foreground"
      onClick={() => setActingUser(null)}
    >
      <LockKeyhole aria-hidden="true" />
      Lock
    </Button>
  );
}
