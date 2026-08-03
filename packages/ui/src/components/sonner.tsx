import * as React from "react";
import { Toaster as Sonner } from "sonner";

// One toast surface per app, mounted once at the root. `richColors` is what
// makes success and failure readable without reading the sentence.
function Toaster({ ...props }: React.ComponentProps<typeof Sonner>) {
  return <Sonner richColors position="top-right" {...props} />;
}

export { Toaster };
