import { fileURLToPath } from "node:url";

import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [
      ".claude/**",
      ".codex/**",
      ".orc2/**",
      ".scratch/**",
      "demo/**",
      "design/**",
      "docs/**",
      "CLAUDE.md",
      "CONTEXT.md",
      "CONTEXT-MAP.md",
    ],
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
  test: {
    setupFiles: [fileURLToPath(new URL("./vitest.setup.ts", import.meta.url))],
  },
});
