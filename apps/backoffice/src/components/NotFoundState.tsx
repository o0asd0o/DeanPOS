import { Link } from "@tanstack/react-router";

// .scratch/decisions/009: the router's defaultNotFoundComponent surface.
export function NotFoundState() {
  return (
    <div role="alert" className="p-4 text-foreground">
      <p>That page doesn&rsquo;t exist.</p>
      <Link to="/">Back to the start</Link>
    </div>
  );
}
