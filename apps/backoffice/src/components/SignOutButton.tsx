import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { SidebarMenuButton } from "ui";

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
    <SidebarMenuButton onClick={handleSignOut} aria-disabled={signOut.isPending}>
      <LogOutIcon />
      Sign out
    </SidebarMenuButton>
  );
}
