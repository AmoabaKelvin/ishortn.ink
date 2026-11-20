import { createConnection } from "mysql2/promise";
import { z } from "zod";

import { dangers } from "../../../scripts/migrations/safety";
import { MIGRATIONS } from "./migrations";

type Env = {
  HYPERDRIVE: { host: string; port: number; user: string; password: string; database: string };
  MIGRATE_KEY: string;
};

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const notFound = () => new Response("Not found", { status: 404 });

async function signed(request: Request, key: string): Promise<boolean> {
  const timestamp = request.headers.get("x-migrate-timestamp") ?? "";
  const signature = request.headers.get("x-migrate-signature") ?? "";
  const action = request.headers.get("x-migrate-action") ?? "";
  const allow = request.headers.get("x-migrate-allow-dangerous") ?? "";
  if (
    !key ||
    !/^[0-9a-f]{64}$/.test(signature) ||
    Math.abs(Date.now() - Number(timestamp)) > MAX_CLOCK_SKEW_MS
  )
    return false;
  const hmac = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = new Uint8Array(signature.match(/../g)!.map((byte) => Number.parseInt(byte, 16)));
  return crypto.subtle.verify(
    "HMAC",
    hmac,
    bytes,
    new TextEncoder().encode(`${timestamp}.${action}.${allow}`),
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST" || !(await signed(request, env.MIGRATE_KEY))) return notFound();
    const action = request.headers.get("x-migrate-action");
    const allowDangerous = request.headers.get("x-migrate-allow-dangerous") === "1";
    if (!MIGRATIONS.length)
      return Response.json(
        {
          ok: false,
          message: "bundle has no migrations; run scripts/migrations/bundle.ts before deploying",
        },
        { status: 500 },
      );

    const db = await createConnection({
      ...env.HYPERDRIVE,
      disableEval: true,
      multipleStatements: false,
    });
    try {
      // Hyperdrive caching is off for this database, so these reads are live.
      const [rows] = await db.query(
        "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
      );
      const last = z
        .array(z.object({ hash: z.string(), created_at: z.union([z.string(), z.number()]) }))
        .parse(rows)[0];
      const lastWhen = last ? Number(last.created_at) : 0;

      // The latest applied migration must be one this repo knows, unchanged.
      const known = MIGRATIONS.find((migration) => migration.when === lastWhen);
      if (last && (!known || known.hash !== last.hash)) {
        return Response.json(
          {
            ok: false,
            message: known
              ? `applied migration ${known.tag} was edited after it ran; refusing to continue`
              : `the database's latest migration (created_at ${lastWhen}) isn't in this repo; refusing to continue`,
          },
          { status: 409 },
        );
      }

      const pending = MIGRATIONS.filter((migration) => migration.when > lastWhen).map(
        (migration) => ({ ...migration, dangers: dangers(migration.statements) }),
      );
      const summary = pending.map(({ tag, dangers: found }) => ({ tag, dangerous: found }));
      const dangerous = pending.filter((migration) => migration.dangers.length);
      if (action === "status")
        return Response.json({ ok: true, latestApplied: known?.tag ?? null, pending: summary });
      if (action !== "apply") return notFound();
      if (dangerous.length && !allowDangerous) {
        return Response.json(
          {
            ok: false,
            message: `refusing dangerous migrations (${dangerous.map((m) => m.tag).join(", ")}); Kelvin can run the deploy workflow by hand with allow_dangerous_migrations`,
            pending: summary,
          },
          { status: 409 },
        );
      }

      const applied: string[] = [];
      for (const migration of pending) {
        try {
          for (const statement of migration.statements) await db.query(statement);
        } catch (error) {
          return Response.json(
            {
              ok: false,
              message: `${migration.tag} failed: ${error instanceof Error ? error.message : String(error)}`,
              applied,
            },
            { status: 500 },
          );
        }
        // Recorded the way drizzle's migrator does, so `db:migrate` agrees.
        await db.query("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", [
          migration.hash,
          migration.when,
        ]);
        applied.push(migration.tag);
      }
      return Response.json({
        ok: true,
        latestApplied: applied.at(-1) ?? known?.tag ?? null,
        applied,
      });
    } finally {
      await db.end();
    }
  },
};
