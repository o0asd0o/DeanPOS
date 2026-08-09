import { SaleScreen } from "@/features/sale/SaleScreen.tsx";
import { useActingUser } from "@/lib/acting-user.tsx";
import { Unlock } from "./Unlock.tsx";

// The gate (issue 10, record 057 Q4): `actingUser ? children : <Unlock/>`,
// specific to "/" for now — it moves up when a second POS screen lands.
export function UnlockGate() {
  const { actingUser } = useActingUser();
  return actingUser ? <SaleScreen /> : <Unlock />;
}
