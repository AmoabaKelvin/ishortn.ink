import { mock } from "bun:test";

// Modules that import env.mjs would otherwise refuse to load without prod secrets.
process.env.SKIP_ENV_VALIDATION = "1";

// env.mjs reads this at import time. Pin the production origin so tests don't depend on a local
// .env (Bun loads it before this preload, and dev setups point it at localhost).
process.env.NEXT_PUBLIC_APP_URL = "https://ishortn.ink";

// Pinned so tests can assert every email send sets reply_to from it.
process.env.EMAIL_REPLY_TO = "replies@mail.ishortn.ink";

// Server-side analytics (src/server/lib/analytics) must never send test events, even when the
// shell has a real PostHog key.
delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

// `server-only` throws outside a React Server Components bundle.
mock.module("server-only", () => ({}));

// Database-backed tests run only when TEST_DATABASE_URL is set; point the app's
// db client at the same disposable database so no test touches the dev one.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
