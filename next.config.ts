import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin (used by src/lib/firebase/admin.ts) has native/dynamic
  // requires that break when bundled by Next's server compiler - this keeps
  // it as a plain Node require resolved from node_modules at runtime
  // instead, which is what actually works in Vercel's serverless functions.
  serverExternalPackages: ["firebase-admin"],
  turbopack: {
    // Pin the workspace root to this project - unrelated lockfiles in
    // parent directories were making Next.js guess wrong.
    root: path.join(__dirname),
  },
};

export default nextConfig;
