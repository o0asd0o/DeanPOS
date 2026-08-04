import { PasswordCard } from "./PasswordCard.tsx";
import { PinCard } from "./PinCard.tsx";
import { ProfileCard } from "./ProfileCard.tsx";

// One screen, sections rather than three separate ones — profile, PIN, and
// (issue 16) password are the same errand (issue 15, record 063 Amendment 1
// §3). `minRole: "cashier"` — every signed-in role reaches this screen.
export function Account() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">Your own profile, PIN, and password.</p>
      </div>
      <ProfileCard />
      <PinCard />
      <PasswordCard />
    </div>
  );
}
