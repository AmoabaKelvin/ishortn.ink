import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { env } from "@/env.mjs";

import * as schema from "./schema";

type Database = MySql2Database<typeof schema>;

function createDb(uri: string, connectionLimit: number): Database {
  // disableEval: workerd forbids eval(), which mysql2's parser codegen uses.
  return drizzle(mysql.createPool({ uri, connectionLimit, disableEval: true }), {
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
  nodeDb ??= drizzle(connection, { schema, mode: "default" });
  return nodeDb;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, _receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

// Backs the Node pool above; the migrate script ends it explicitly. Pools open
// no sockets until first query, so this stays inert on Workers.
export const connection = mysql.createPool({
  uri: env.DATABASE_URL,
  connectionLimit: 20,
});
