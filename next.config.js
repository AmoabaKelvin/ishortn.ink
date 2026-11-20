import("./src/env.mjs");

// Dev-only: boots wrangler's binding emulator for `next dev`. Guarded so
// production builds (OpenNext) don't require local Hyperdrive config.
if (process.env.NODE_ENV === "development") {
  // Wrangler refuses to emulate Hyperdrive without a local connection string.
  process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??= process.env.DATABASE_URL;
  const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}

const createMDX = require("@next/mdx");

// Docs pages (content/docs) are MDX compiled at build time. Plugins are named
// by string so the options stay serializable for Turbopack.
const withMDX = createMDX({
  options: {
    remarkPlugins: [["remark-frontmatter"], ["remark-gfm"]],
    rehypePlugins: [["rehype-slug"], [require.resolve("./src/lib/docs/rehype-code.mjs")]],
  },
});

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

module.exports = withMDX(config);
