import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Stagehand v4 ships a browser extension that must be available to the
  // Vercel server function at runtime. Keep the SDK external so Next.js does
  // not try to bundle its Node/browser-driver internals.
  outputFileTracingIncludes: {
    "/api/runs/execute": [
      "./node_modules/@browserbasehq/stagehand/dist/assets/stagehand-extension.zip",
    ],
  },
  serverExternalPackages: [
    "@browserbasehq/stagehand",
    "@browserbasehq/sdk",
  ],
};

export default nextConfig;
