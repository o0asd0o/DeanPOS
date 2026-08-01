import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// `vp test` runs each package with that package's directory as cwd, so
// Bun's own .env autoload (cwd-only) never reaches the workspace-root
// `.env` a lane's DATABASE_URI lives in. Load it here, once, for every
// package's test run.
const workspaceRoot = dirname(fileURLToPath(import.meta.url));

try {
  const contents = readFileSync(resolve(workspaceRoot, ".env"), "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (key in process.env) continue;
    process.env[key] = trimmed.slice(separator + 1).trim();
  }
} catch {
  // No workspace-root .env (e.g. real environment variables already set).
}
