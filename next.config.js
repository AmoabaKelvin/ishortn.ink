import("./src/env.mjs");

// Dev-only: boots wrangler's binding emulator for `next dev`. Guarded so
// production builds (OpenNext) don't require local Hyperdrive config.
if (process.env.NODE_ENV === "development") {
  // Wrangler refuses to emulate Hyperdrive without a local connection string.
  process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??= process.env.DATABASE_URL;
  const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}

/** @type {import("next").NextConfig} */
const config = {
  // CLAUDE.md is maintained by hand; stop `next dev` injecting its agent block.
  agentRules: false,
  // The deploy runs in GitHub Actions; Workers Builds names the same thing differently.
  env: {
    BUILD_COMMIT_SHA: process.env.GITHUB_SHA ?? process.env.WORKERS_CI_COMMIT_SHA ?? "",
  },
  experimental: {
    optimizePackageImports: ["@tabler/icons-react"],
  },
  // Keep pino and its transport worker out of the bundler so Node can resolve
  // `pino-pretty` (and thread-stream) from node_modules at runtime. Bundling
  // them breaks the worker_threads path pino uses for transports.
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // Guessable auth URLs. Scoped to the app host so `/sign-in` stays usable as a
  // short-link alias on the short and custom domains.
  async redirects() {
    const has = [{ type: "host", value: "(?:www\\.)?ishortn\\.ink|localhost" }];
    return [
      { source: "/sign-in", destination: "/auth/sign-in", permanent: true, has },
      { source: "/sign-up", destination: "/auth/sign-up", permanent: true, has },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

module.exports = config;
