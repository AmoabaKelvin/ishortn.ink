import("./src/env.mjs");

/** @type {import("next").NextConfig} */
const config = {
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
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

module.exports = config;
