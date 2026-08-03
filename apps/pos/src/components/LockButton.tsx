import { Button } from "ui";

import { useActingUser } from "@/lib/acting-user.tsx";

export function LockButton() {
  const { actingUser, setActingUser } = useActingUser();
  if (actingUser === null) return null;
  return (
    <Button variant="outline" size="sm" onClick={() => setActingUser(null)}>
      Lock
    </Button>
  );
}
