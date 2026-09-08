# Contributing to iShortn

Thanks for helping. This page covers the day-to-day workflow; the README has the one-command setup.

## Setup

```bash
bun install
bun run setup    # .env, secrets, MySQL via Docker, schema, sample data
bun dev
```

`bun run setup` is safe to re-run. It never overwrites values already in `.env`, so edit that file
freely. `bun run stack:reset` throws the database away; run `setup` again to rebuild it.

Tool versions are pinned in `mise.toml` (`mise install`), matching CI.

## Day-to-day

| Task                                                | Command                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Run the app                                         | `bun dev`                                                                                 |
| Seed sample data for the account you signed in with | `bun run seed --email you+clerk_test@example.com`                                         |
| Replay a webhook                                    | `bun run webhook clerk user.created`, `bun run webhook lemonsqueezy subscription_created` |
| Trigger a cron route                                | `bun run cron cleanup-expired`                                                            |
| Inspect the database                                | `bun run db:studio`                                                                       |
| Preview email templates                             | `bun run email:dev`                                                                       |
| Run under workerd (queues, KV)                      | `bun run preview`                                                                         |
| Tests, types, lint, format                          | `bun test`, `bun run typecheck`, `bun run lint`, `bun run format`                         |

Sign in with a Clerk test address (`anything+clerk_test@example.com`, code `424242`). Your user row
is created on the first authenticated request, so no webhook delivery is needed locally.

## Schema changes

1. Edit `src/server/db/schema.ts`.
2. `bun run db:push` to apply it to your local database (this is what `setup` runs).
3. `bun run db:generate` to produce the SQL migration under `drizzle/` that production applies.
4. Commit both the schema and the generated migration.

The migration chain in `drizzle/` was started against the production database and does not replay
on an empty one, which is why local databases are built with `db:push` rather than `db:migrate`.

## Environment variables

Every variable must be declared in `src/env.mjs` (validated at boot) and documented in
`.env.example` under the feature it unlocks. Keep new variables optional unless the app genuinely
cannot start without them; feature code should fail with a clear message when its integration is
not configured (see `src/server/api/routers/domains/cloudflare.ts` for the pattern).

## External services locally

- **Clerk**: development instance keys in `.env`; test-mode emails and OTP as above.
- **Webhooks**: `bun run webhook` signs fixtures from `scripts/dev/fixtures/` with the secret in
  `.env`. For real deliveries, `bun run tunnel` exposes port 3000 through a Cloudflare quick tunnel.
- **Cloudflare bindings**: `next dev` boots wrangler's emulator, so KV and the queue binding exist;
  clicks are ingested inline in development. Hyperdrive is pointed at `DATABASE_URL` automatically.
- **R2**: `docker compose --profile storage up -d` runs MinIO; enable the `R2_*` block in `.env`.
- **Resend**: sends are skipped (and logged) without `RESEND_API_KEY`.
- **Lemon Squeezy, OpenAI, Safe Browsing, PostHog, Discord**: off until their keys are set.

## Code style

- TypeScript, formatted by [oxfmt](https://oxc.rs/docs/guide/usage/formatter) (`bun run format`) and
  linted by [oxlint](https://oxc.rs/docs/guide/usage/linter) (`bun run lint`), including the
  [anti-slop](https://github.com/dmmulroy/anti-slop) rules vendored in `tools/oxlint/anti-slop`.
- Server code reads configuration through `env` from `@/env.mjs`, not `process.env`.
- Keep edge middleware (`src/middleware.ts`) free of Node-only imports.
- Small, focused commits; conventional prefixes (`feat:`, `fix:`, `chore:`) as in the git history.

## Pull requests

1. Open an issue first for anything larger than a bug fix.
2. Branch from `main`; keep one feature or fix per PR.
3. Run `bun run typecheck`, `bun run lint`, `bun run format` and `bun test`; CI runs all of them
   on every PR, plus the Worker build.
4. Fill in the PR template and link the issue.
