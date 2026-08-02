import { fileURLToPath } from "node:url";

import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackRouter({
      target: "react",
      generatedRouteTree: "./src/generated/routeTree.gen.ts",
      addExtensions: ".tsx",
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    port: 6004,
    strictPort: true,
  },
  test: {
    environment: "happy-dom",
    setupFiles: [fileURLToPath(new URL("../../vitest.setup.ts", import.meta.url))],
  },
});
