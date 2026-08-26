import { mock } from "bun:test";

// Modules that import env.mjs would otherwise refuse to load without prod secrets.
process.env.SKIP_ENV_VALIDATION = "1";

// `server-only` throws outside a React Server Components bundle.
mock.module("server-only", () => ({}));
