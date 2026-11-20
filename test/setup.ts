import { mock } from "bun:test";

// Modules that import env.mjs would otherwise refuse to load without prod secrets.
process.env.SKIP_ENV_VALIDATION = "1";

// `server-only` throws outside a React Server Components bundle.
mock.module("server-only", () => ({}));

// Database-backed tests run only when TEST_DATABASE_URL is set; point the app's
// db client at the same disposable database so no test touches the dev one.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
