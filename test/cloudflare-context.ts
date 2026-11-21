// OpenNext reads the request context (bindings, waitUntil) from this global.
// Off-platform it is missing, so code that calls runBackgroundTask throws.
const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");

/** Installs a context with an in-memory KV and a no-op waitUntil; returns the cleanup. */
export function stubCloudflareContext(): () => void {
  const store = new Map<string, string>();
  Reflect.set(globalThis, CLOUDFLARE_CONTEXT, {
    env: {
      LINK_CACHE_KV: {
        get: async (key: string) => store.get(key) ?? null,
        put: async (key: string, value: string) => void store.set(key, value),
        delete: async (key: string) => void store.delete(key),
      },
    },
    cf: {},
    ctx: { waitUntil: () => {} },
  });
  return () => Reflect.deleteProperty(globalThis, CLOUDFLARE_CONTEXT);
}
