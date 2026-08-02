import { Outlet } from "@tanstack/react-router";

// The layout answer for `/login` and `/set-password` (record 030): `my-auto`
// on the child, not `justify-center` on the parent, so an overflowing card
// scrolls instead of clipping on a phone in landscape.
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh justify-center bg-background p-4 text-foreground">
      <div className="my-auto w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
