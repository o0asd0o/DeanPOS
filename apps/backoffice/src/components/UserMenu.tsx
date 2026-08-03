import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { ChevronDownIcon, LogOutIcon, SettingsIcon, UserRoundIcon } from "lucide-react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "ui";

// The one reachable path to auth.signOut. The confirm dialog is controlled
// rather than triggered, because the menu unmounts its own items on select and
// a `DialogTrigger` inside one closes with them.
export function UserMenu() {
  const { orpc } = useRouteContext({ from: "/_shell" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const me = useQuery(orpc.auth.me.queryOptions());
  const signOut = useMutation(orpc.auth.signOut.mutationOptions());

  const handleSignOut = async () => {
    await signOut.mutateAsync();
    queryClient.clear();
    await navigate({ to: "/login" });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2" aria-label="Account">
            <UserRoundIcon />
            <ChevronDownIcon className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{me.data?.authenticated ? me.data.role : "Account"}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/settings">
              <SettingsIcon />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirmingSignOut(true)}>
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirmingSignOut} onOpenChange={setConfirmingSignOut}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure you want to logout?</DialogTitle>
            <DialogDescription>You will need to sign in again to come back.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSignOut} aria-disabled={signOut.isPending}>
              {signOut.isPending ? "Signing out…" : "Sign out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
