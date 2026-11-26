import type { NextConfig } from "next";

/*
 * The app is client-first (wallet state, live chain reads), so Cache Components stays off: every route renders on
 * request and the deployment loader reads contracts/deployments/local.json fresh each time.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
