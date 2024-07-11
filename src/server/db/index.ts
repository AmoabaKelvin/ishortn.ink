import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { env } from "@/env";

import * as schema from "./schema";

export const connection = mysql.createPool({
  uri: env.DATABASE_URL,
  connectionLimit: 20,
});

export const db = drizzle(connection, { schema, mode: "default" });
