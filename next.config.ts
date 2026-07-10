import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack scoped to this repository even when a parent directory
  // contains another lockfile. Vercel also treats this directory as the app root.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
