import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep `next dev` from generating an AGENTS.md inside the app.
  agentRules: false,
};

export default nextConfig;
