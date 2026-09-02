import "dotenv/config";

import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

// Deliberately does not import ./index: that pulls in env.mjs, which demands
// every app secret. Migrations only need the database.
void (async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const connection = await mysql.createConnection(url);
  await migrate(drizzle(connection), { migrationsFolder: "./drizzle" });
  await connection.end();
})();
