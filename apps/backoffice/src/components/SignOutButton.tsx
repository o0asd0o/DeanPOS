import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  SidebarMenuButton,
} from "ui";

// The only reachable path to auth.signOut in this app (issue 03 round 2) —
// the procedure existed and was tested, but nothing called it.
export function SignOutButton() {
  const { orpc } = useRouteContext({ from: "/_shell" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signOut = useMutation(orpc.auth.signOut.mutationOptions());

  const handleSignOut = async () => {
    await signOut.mutateAsync();
    queryClient.clear();
    await navigate({ to: "/login" });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <SidebarMenuButton>
          <LogOutIcon />
          Sign out
        </SidebarMenuButton>
      </DialogTrigger>
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
  );
}
