import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { env } from "@/env";

import * as schema from "./schema";

export const connection = await mysql.createConnection({
  uri: env.DATABASE_URL,
  enableKeepAlive: true,
  keepAliveInitialDelay: 1000,
});

export const db = drizzle(connection, { schema, mode: "default" });
