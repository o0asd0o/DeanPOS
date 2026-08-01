import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // TypeScript 7.0.2 (typescript-go) has no compiler API — Next needs its CLI instead.
  experimental: { useTypeScriptCli: true },
};

export default nextConfig;
