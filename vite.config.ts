import { defineConfig } from "vite-plus";

export default defineConfig({
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
});
