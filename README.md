<h1 align="center">iShortn</h1>

<p align="center">
  Short links that track every click. Create branded short links with powerful analytics, QR codes, UTM templates, custom domains, and more.
</p>

<p align="center">
  <a href="https://ishortn.ink">ishortn.ink</a> &nbsp;·&nbsp;
  <a href="#about">About</a> &nbsp;·&nbsp;
  <a href="#features">Features</a> &nbsp;·&nbsp;
  <a href="#screenshots">Screenshots</a> &nbsp;·&nbsp;
  <a href="#tech-stack">Tech Stack</a> &nbsp;·&nbsp;
  <a href="#getting-started">Getting Started</a> &nbsp;·&nbsp;
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/AmoabaKelvin/ishortn.ink/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/AmoabaKelvin/ishortn.ink" alt="License" />
  </a>
  <a href="https://github.com/AmoabaKelvin/ishortn.ink/stargazers">
    <img src="https://img.shields.io/github/stars/AmoabaKelvin/ishortn.ink" alt="Stars" />
  </a>
  <a href="https://github.com/AmoabaKelvin/ishortn.ink/network/members">
    <img src="https://img.shields.io/github/forks/AmoabaKelvin/ishortn.ink" alt="Forks" />
  </a>
  <a href="https://github.com/AmoabaKelvin/ishortn.ink/issues">
    <img src="https://img.shields.io/github/issues/AmoabaKelvin/ishortn.ink" alt="Issues" />
  </a>
</p>

<br />

<p align="center">
  <img src=".github/assets/landing-hero.png" alt="iShortn landing page" width="100%" />
</p>

<br />

## About

iShortn is an open-source URL shortener and link intelligence platform. It turns long URLs into short, branded links and gives you deep insight into every click — country, city, device, referrer, and hour-by-hour trends — without shipping third-party cookies or chasing visitors across the web.

Use it for marketing campaigns, product onboarding, event tracking, newsletter links, QR codes on printed material, or as a self-hosted alternative to proprietary shorteners.

## Features

### Link management

- Custom short aliases and friendly names
- Custom domains
- Password-protected links
- Expiration dates and click limits
- One-click deactivation
- Folders to organise links
- UTM builder and reusable templates
- QR code generation with logo overlay
- Bulk CSV import and export
- Full REST API for links

### Analytics

- Total clicks and unique visitors
- Country, region, and city breakdowns
- Device, OS, and browser stats
- Referrer and source tracking
- Time-series click charts
- Per-link dashboards
- Privacy-friendly tracking (no third-party cookies)

### Platform

- Authenticated workspaces via Clerk
- Usage-based billing with Lemon Squeezy and Stripe
- Transactional email via Resend and React Email
- S3-compatible object storage via Cloudflare R2
- Dark and light themes
- Built-in safe-browsing checks for submitted URLs

## Screenshots

### Dashboard

Manage all your links, filter by status and tags, and see click counts at a glance.

<p align="center">
  <img src=".github/assets/dashboard-links.png" alt="iShortn dashboard listing links" width="100%" />
</p>

### Analytics

Per-link analytics with click volume over time, unique visitor counts, and geography and device breakdowns.

<p align="center">
  <img src=".github/assets/analytics-dashboard.png" alt="iShortn analytics view for a single link" width="100%" />
</p>

## Tech Stack

- **Framework** — [Next.js 15](https://nextjs.org) (App Router, Turbopack) on [React 19](https://react.dev)
- **Language** — [TypeScript](https://www.typescriptlang.org)
- **Styling** — [Tailwind CSS](https://tailwindcss.com), [Radix UI](https://www.radix-ui.com), [Framer Motion](https://www.framer.com/motion/)
- **Database** — [MySQL](https://www.mysql.com) with [Drizzle ORM](https://orm.drizzle.team)
- **Cache** — [Redis](https://redis.io) via [ioredis](https://github.com/redis/ioredis)
- **API layer** — [tRPC](https://trpc.io) with [TanStack Query](https://tanstack.com/query)
- **Auth** — [Clerk](https://clerk.com)
- **Billing** — [Lemon Squeezy](https://www.lemonsqueezy.com) and [Stripe](https://stripe.com)
- **Object storage** — [Cloudflare R2](https://developers.cloudflare.com/r2/)
- **Email** — [Resend](https://resend.com) with [React Email](https://react.email)
- **Product analytics** — [PostHog](https://posthog.com)
- **AI** — [Vercel AI SDK](https://sdk.vercel.ai) with OpenAI
- **Package manager / runtime** — [Bun](https://bun.sh)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.1 or newer
- [Docker](https://docs.docker.com/get-docker/) (optional, for local MySQL and Redis)
- A [Clerk](https://clerk.com) application for authentication
- A [Resend](https://resend.com) account if you want outbound email

### 1. Clone and install

```bash
git clone https://github.com/AmoabaKelvin/ishortn.ink.git
cd ishortn.ink
bun install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

At a minimum the following variables must be set for the app to boot:

| Variable | Example | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `mysql://ishortn:ishortn@localhost:3306/ishortn_rewrite` | MySQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Used for caching and rate limiting |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public base URL of the app |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | From the Clerk dashboard |
| `CLERK_SECRET_KEY` | `sk_test_...` | From the Clerk dashboard |

Optional integrations (Resend email, Stripe, Lemon Squeezy, Cloudflare R2, PostHog, Google Safe Browsing, Discord webhooks) can be left empty until you need them — see `.env.example` and `src/env.mjs` for the full list.

### 3. Start MySQL and Redis locally

The repo ships with a Docker Compose file that boots MySQL and Redis with sensible defaults.

```bash
docker compose -f docker/docker-compose.yml up -d
```

Or run the Docker stack and the dev server together with a single command:

```bash
bun run d
```

### 4. Push the database schema

```bash
bun run db:push
```

Open Drizzle Studio any time to inspect the tables:

```bash
bun run db:studio
```

### 5. Run the app

```bash
bun dev
```

The app is now running at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
| --- | --- |
| `bun dev` | Start the Next.js dev server with Turbopack |
| `bun run d` | Boot the Docker stack and start the dev server |
| `bun run build` | Production build |
| `bun start` | Start the production server |
| `bun run typecheck` | Run `tsc --noEmit` |
| `bun run lint` | Run Next.js + Biome linting |
| `bun run db:push` | Push the Drizzle schema to the database |
| `bun run db:generate` | Generate SQL migrations |
| `bun run db:migrate` | Run migrations against the configured database |
| `bun run db:studio` | Open Drizzle Studio |

## Contributing

Contributions are welcome. If you find a bug or want to propose a feature:

1. [Open an issue](https://github.com/AmoabaKelvin/ishortn.ink/issues) describing the problem or idea first, especially for larger changes.
2. Fork the repo and create a feature branch.
3. Keep PRs focused — one feature or fix per PR.
4. Run `bun run typecheck` and `bun run lint` before pushing.
5. Open a pull request against `main`.

Code style is enforced by [Biome](https://biomejs.dev) via `bun run lint`.

## License

Released under the [MIT License](./LICENSE).
