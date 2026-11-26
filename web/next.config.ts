import type { NextConfig } from "next";

/*
 * The app is client-first (wallet state, live chain reads), so Cache Components stays off: every route renders on
 * request and the deployment loader reads contracts/deployments/local.json fresh each time.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // the tools moved into Settings; old links keep working
  async redirects() {
    return [
      { source: "/app/faucet", destination: "/app/settings/funds", permanent: false },
      { source: "/app/simulator", destination: "/app/settings/simulator", permanent: false },
      { source: "/app/demo", destination: "/app/settings/demo", permanent: false },
      // Ask AI is now Covenant AI; /app/ask stays its route, /app/covenant-ai is an alias (the query string carries over)
      { source: "/app/covenant-ai", destination: "/app/ask", permanent: false },
      // the contact page was removed; old links land on the home page
      { source: "/contact", destination: "/", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "{globals,app}.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
