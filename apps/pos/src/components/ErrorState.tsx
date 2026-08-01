import { Button } from "ui";

// Copy, roles and colour are fixed by .scratch/decisions/009 — replaceable only there.
export function ErrorState({
  onRetry,
  isFetching = false,
}: {
  onRetry: () => void;
  isFetching?: boolean;
}) {
  return (
    <div role="alert" aria-busy={isFetching} className="p-4 text-foreground">
      <p>Can&rsquo;t reach the server.</p>
      <p>Check the connection and try again.</p>
      <Button onClick={onRetry} className="touch-min">
        Try again
      </Button>
    </div>
  );
}
