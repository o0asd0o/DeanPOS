import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

type ActingUser = { userId: string; displayName: string };

type ActingUserContextValue = {
  actingUser: ActingUser | null;
  setActingUser: (user: ActingUser | null) => void;
};

const ActingUserContext = createContext<ActingUserContextValue | null>(null);

// In memory only — does not survive a reload (issue 10, record 057 Q5).
// Lock is `setActingUser(null)` and nothing else: it must never touch
// `deanpos.device.token`, `deanpos.device.identity`, or `deanpos.pin.roster`.
export function ActingUserProvider({ children }: { children: ReactNode }) {
  const [actingUser, setActingUser] = useState<ActingUser | null>(null);
  return (
    <ActingUserContext.Provider value={{ actingUser, setActingUser }}>
      {children}
    </ActingUserContext.Provider>
  );
}

export function useActingUser(): ActingUserContextValue {
  const value = useContext(ActingUserContext);
  if (!value) throw new Error("useActingUser must be used within ActingUserProvider");
  return value;
}

export function useOptionalActingUser(): ActingUserContextValue | null {
  return useContext(ActingUserContext);
}
