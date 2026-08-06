import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to this project - unrelated lockfiles in
    // parent directories were making Next.js guess wrong.
    root: path.join(__dirname),
  },
};

export default nextConfig;
