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

const { clerkScriptVersions } = require("./scripts/build/clerk-script-versions.cjs");

const clerkVersions = clerkScriptVersions();

// Docs pages (content/docs) are MDX compiled at build time. Plugins are named
// by string so the options stay serializable for Turbopack.
const withMDX = createMDX({
  options: {
    remarkPlugins: [["remark-frontmatter"], ["remark-gfm"]],
    rehypePlugins: [["rehype-slug"], [require.resolve("./src/lib/docs/rehype-code.mjs")]],
  },
});

/** Host condition for rules that only apply on the app domain (and local dev). */
function appHostMatcher() {
  const appDomain = (
    process.env.NEXT_PUBLIC_APP_DOMAIN?.trim().toLowerCase() || "ishortn.ink"
  ).replaceAll(".", "\\.");
  return [{ type: "host", value: `(?:www\\.)?${appDomain}|localhost` }];
}

/** @type {import("next").NextConfig} */
const config = {
  // CLAUDE.md is maintained by hand; stop `next dev` injecting its agent block.
  agentRules: false,
  // The deploy runs in GitHub Actions; Workers Builds names the same thing differently.
  env: {
    BUILD_COMMIT_SHA: process.env.GITHUB_SHA ?? process.env.WORKERS_CI_COMMIT_SHA ?? "",
    // Read by @clerk/nextjs to build exact-version script URLs (see clerk-script-versions.cjs).
    NEXT_PUBLIC_CLERK_JS_VERSION:
      process.env.NEXT_PUBLIC_CLERK_JS_VERSION || clerkVersions.js || "",
    NEXT_PUBLIC_CLERK_UI_VERSION:
      process.env.NEXT_PUBLIC_CLERK_UI_VERSION || clerkVersions.ui || "",
  },
  turbopack: {
    rules: {
      // Blog posts are imported as strings (import.meta.glob with ?raw in src/lib/blog.ts).
      "*.md": { condition: { query: "?raw" }, type: "text" },
    },
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
    const has = appHostMatcher();
    return [
      { source: "/sign-in", destination: "/auth/sign-in", permanent: true, has },
      { source: "/sign-up", destination: "/auth/sign-up", permanent: true, has },
    ];
  },
  async headers() {
    const appHost = appHostMatcher();
    return [
      // Point crawlers and AI agents at llms.txt and the sitemap from marketing pages. Scoped to
      // the app host because on short and custom domains these paths are short links or bio pages.
      ...["/", "/pricing", "/features", "/compare/:path*", "/docs/:path*", "/blog/:path*"].map(
        (source) => ({
          source,
          has: appHost,
          headers: [
            {
              key: "Link",
              value: '</llms.txt>; rel="describedby", </sitemap.xml>; rel="sitemap"',
            },
          ],
        }),
      ),
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
      // The extension connect page hands out a token: never cache it, never leak its query
      // (redirect_uri, state) as Referer. Framing is already denied above.
      {
        source: "/extension/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      // Shared link analytics: the token in the path is the credential, so never send it as
      // Referer, and keep the pages out of search indexes.
      {
        source: "/stats/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      // The only non-English page; the root layout's <html lang="en"> can't vary per route.
      {
        source: "/gerador-de-link-whatsapp",
        headers: [{ key: "Content-Language", value: "pt-BR" }],
      },
    ];
  },
};

module.exports = withMDX(config);
