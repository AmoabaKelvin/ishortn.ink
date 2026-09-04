import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { env } from "@/env.mjs";

import * as schema from "./schema";

type Database = MySql2Database<typeof schema>;

function createDb(uri: string, connectionLimit: number): Database {
  // Hyperdrive's connection string carries ssl-mode, which mysql2 rejects and
  // warns about via console.error on every connection; Hyperdrive terminates
  // TLS itself, so the param does nothing here.
  const url = new URL(uri);
  url.searchParams.delete("ssl-mode");
  // disableEval: workerd forbids eval(), which mysql2's parser codegen uses.
  return drizzle(mysql.createPool({ uri: url.toString(), connectionLimit, disableEval: true }), {
    schema,
    mode: "default",
  });
}

// Workers forbid sharing sockets across requests, so each request gets its own
// pool via Hyperdrive (which does the real pooling upstream). Node keeps one
// process-wide pool as before.
const perRequest = new WeakMap<object, Database>();
let nodeDb: Database | undefined;

function getDb(): Database {
  try {
    const { env: cfEnv, ctx } = getCloudflareContext();
    const connectionString = cfEnv.HYPERDRIVE?.connectionString;
    if (connectionString) {
      let instance = perRequest.get(ctx);
      if (!instance) {
        instance = createDb(connectionString, 5);
        perRequest.set(ctx, instance);
      }
      return instance;
    }
  } catch {
    // Not running on Cloudflare — fall through to the Node pool.
  }
  nodeDb ??= createDb(env.DATABASE_URL, 20);
  return nodeDb;
}

// SAFETY: the empty target is never read; the `get` trap forwards every
// property to the per-request Database resolved by getDb().
const proxyTarget = {} as Database;

export const db = new Proxy(proxyTarget, {
  get(_target, prop: keyof Database) {
    const instance = getDb();
    const value = instance[prop];
    return value instanceof Function ? value.bind(instance) : value;
  },
});
