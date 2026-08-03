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
    // Every workspace shares one CPU and one database, and the crypto is real:
    // scrypt at ~260ms per sign-in, PBKDF2 at 600,000 iterations per PIN
    // (records 028, 057). Vitest's 5s default expires on work that is only slow.
    testTimeout: 15_000,
  },
});
