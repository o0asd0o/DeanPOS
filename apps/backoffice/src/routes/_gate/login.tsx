import { createFileRoute } from "@tanstack/react-router";

import { SignIn } from "../../features/signin/SignIn.tsx";

// Thin: wires the route to the feature and nothing else (ADR-0009).
export const Route = createFileRoute("/_gate/login")({
  component: SignIn,
});
