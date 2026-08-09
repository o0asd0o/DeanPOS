import { Button } from "ui";

import { useActingUser } from "@/lib/acting-user.tsx";

export function LockButton() {
  const { actingUser, setActingUser } = useActingUser();
  if (actingUser === null) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      onClick={() => setActingUser(null)}
    >
      Lock
    </Button>
  );
}
