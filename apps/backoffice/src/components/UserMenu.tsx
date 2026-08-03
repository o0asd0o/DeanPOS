import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { LogOutIcon, SettingsIcon } from "lucide-react";
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

import { SettingsDialog } from "@/features/settings/SettingsDialog.tsx";

import { displayNameFromEmail, initialsFromEmail } from "./helpers.ts";

// The one reachable path to auth.signOut. The confirm dialog is controlled
// rather than triggered, because the menu unmounts its own items on select and
// a `DialogTrigger` inside one closes with them. Record 048.
export function UserMenu() {
  const { orpc } = useRouteContext({ from: "/_shell" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const me = useQuery(orpc.auth.me.queryOptions());
  const signOut = useMutation(
    orpc.auth.signOut.mutationOptions({
      meta: { success: "Signed out", error: "Couldn't sign out" },
    }),
  );

  const email = me.data?.authenticated ? me.data.email : undefined;
  const role = me.data?.authenticated ? me.data.role : undefined;

  const handleSignOut = async () => {
    await signOut.mutateAsync();
    queryClient.clear();
    await navigate({ to: "/login" });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* Initials until a User carries a photo — record 048. The name and
              email they stand for are one click away, inside the menu. */}
          <Button
            variant="ghost"
            className="size-10 rounded-full bg-muted p-0 text-sm font-medium text-muted-foreground hover:bg-hover"
            aria-label="Account"
          >
            {initialsFromEmail(email)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="font-medium">{displayNameFromEmail(email)}</span>
            <span className="text-xs font-normal text-muted-foreground">{email}</span>
            {/* The role stays in the menu — record 048 put it here. */}
            <span className="text-xs font-normal text-muted-foreground capitalize">{role}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* Admin-only (record 046 §4). Hiding it is presentation; the
              handler's own refusal is the enforcement. */}
          {role === "admin" && (
            <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
              <SettingsIcon />
              Settings
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setConfirmingSignOut(true)}>
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
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
