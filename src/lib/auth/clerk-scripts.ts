import { clerkJSScriptUrl, clerkUIScriptUrl } from "@clerk/shared/loadClerkJsScript";

export type ClerkScripts = {
  /** Clerk's frontend API origin, or null when it is served through a same-origin proxy. */
  origin: string | null;
  /** clerk.browser.js and ui.browser.js, at the versions the auth pages load. */
  scripts: [clerkJs: string, clerkUi: string];
};

// Written out, not read as process.env[name]: next.config.js pins the script versions through
// `env`, which Next inlines only where `process.env.NAME` appears literally.
const clerkEnv = () => ({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_CLERK_DOMAIN: process.env.NEXT_PUBLIC_CLERK_DOMAIN,
  NEXT_PUBLIC_CLERK_PROXY_URL: process.env.NEXT_PUBLIC_CLERK_PROXY_URL,
  NEXT_PUBLIC_CLERK_JS_URL: process.env.NEXT_PUBLIC_CLERK_JS_URL,
  NEXT_PUBLIC_CLERK_JS_VERSION: process.env.NEXT_PUBLIC_CLERK_JS_VERSION,
  NEXT_PUBLIC_CLERK_UI_URL: process.env.NEXT_PUBLIC_CLERK_UI_URL,
  NEXT_PUBLIC_CLERK_UI_VERSION: process.env.NEXT_PUBLIC_CLERK_UI_VERSION,
});

type ClerkScriptEnv = Partial<ReturnType<typeof clerkEnv>>;

/**
 * The Clerk scripts the auth pages will request, built with the same @clerk/shared functions and
 * environment variables @clerk/nextjs uses (mergeNextClerkPropsWithEnv, ClerkScriptTags), so the
 * URLs follow Clerk upgrades. (Its Vercel-only automatic proxy doesn't apply on Workers.) Null
 * without a publishable key.
 */
export function getClerkScripts(environment: ClerkScriptEnv = clerkEnv()): ClerkScripts | null {
  const publishableKey = environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return null;
  const opts = {
    publishableKey,
    domain: environment.NEXT_PUBLIC_CLERK_DOMAIN,
    proxyUrl: environment.NEXT_PUBLIC_CLERK_PROXY_URL,
    __internal_clerkJSUrl: environment.NEXT_PUBLIC_CLERK_JS_URL,
    __internal_clerkJSVersion: environment.NEXT_PUBLIC_CLERK_JS_VERSION,
    __internal_clerkUIUrl: environment.NEXT_PUBLIC_CLERK_UI_URL,
    __internal_clerkUIVersion: environment.NEXT_PUBLIC_CLERK_UI_VERSION,
  };
  const clerkJs = clerkJSScriptUrl(opts);
  return {
    origin: URL.canParse(clerkJs) ? new URL(clerkJs).origin : null,
    scripts: [clerkJs, clerkUIScriptUrl(opts)],
  };
}
