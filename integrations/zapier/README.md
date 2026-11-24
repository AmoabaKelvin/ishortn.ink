# iShortn for Zapier

A [Zapier](https://zapier.com) integration for [iShortn](https://ishortn.ink), built with the
Zapier Platform CLI (`zapier-platform-core` 19.3.0, Node 22). It uses the public
[v1 API](https://ishortn.ink/docs/api) with an API key, so connecting an account needs a Pro or
Ultra plan.

## Operations

| Operation | Type | Endpoint |
| --- | --- | --- |
| New Link | Polling trigger | `GET /api/v1/links?limit=100` (newest first, deduped on `id`) |
| Create Short Link | Action | `POST /api/v1/links` |
| Update Link | Action | `PATCH /api/v1/links/{alias}?domain=…` |
| Find Link | Search | `GET /api/v1/links/{alias}?domain=…` |
| Find Link Clicks | Search | `GET /api/v1/analytics/{alias}?domain=…` |
| Find or Create Link | Search or create | Find Link, then Create Short Link when nothing matches |
| Links dropdown (hidden) | Dynamic dropdown | `GET /api/v1/links?limit=100&cursor=…` |
| Connection test | Authentication | `GET /api/v1/me` |

Update Link and Find Link Clicks take a **Link** field: pick a link from the dropdown, or map a
short link (`https://isht.app/launch-day`), `domain/alias`, or a bare alias (resolved on the
optional Domain field, or the account's default domain).

Create Short Link's link password field is labelled **Passcode** (key `linkPasscode`) and sent to
the API as `password`. Zapier's integration checks reject input fields named "password" (check
D001, meant for credentials).

Errors: an invalid or deleted key asks the user to reconnect, the plan `403` links to pricing,
`429` is retried after `Retry-After` (or `X-RateLimit-Reset`), and API validation messages are
shown with their field details. Searches return no results on `404`.

## Local development

Node 22 or later.

```bash
cd integrations/zapier
npm install
npm test                      # jest + nock, no network
npx zapier-platform validate  # schema and integration checks
```

`integrations/zapier` has its own toolchain and is excluded from the root build, lint, format,
typecheck and `bun test`.

## Testing against a real account

Use an API key from a Pro or Ultra account (Settings → API Keys). Put it in `.env` (ignored by
git) as `authData_api_key=…`, or let the CLI prompt for it:

```bash
npx zapier-platform invoke auth start      # stores the key in .env
npx zapier-platform invoke auth test
npx zapier-platform invoke trigger new_link
npx zapier-platform invoke trigger links_dropdown
npx zapier-platform invoke create create_link --inputData '{"url":"https://example.com"}'
npx zapier-platform invoke create update_link --inputData '{"link":"https://isht.app/abc123","url":"https://example.com/new"}'
npx zapier-platform invoke search find_link --inputData '{"link":"https://isht.app/abc123"}'
npx zapier-platform invoke search link_clicks --inputData '{"link":"https://isht.app/abc123"}'
```

To run against a local iShortn server, set `ISHORTN_API_BASE`, for example
`ISHORTN_API_BASE=http://localhost:3000/api/v1`. The published app always uses
`https://ishortn.ink/api/v1`.

`invoke` starts a new cursor store on every run, so it can't walk the Links dropdown past the
first page. `bundle.meta.page` > 0 works in Zapier itself.

## Publishing

1. `npx zapier-platform login` with the Zapier account that owns the integration (its admin
   email is on the `ishortn.ink` domain).
2. First time only: `npx zapier-platform register "iShortn"`. This writes `.zapierapprc` with the
   app id; it stays out of git.
3. `npx zapier-platform validate --fail-for-publishing`
4. `npx zapier-platform push`
5. Test every trigger, action and search in a live Zap.
6. Submit the integration for public review in the Zapier developer platform.

Later versions: bump `version` in `package.json` and add a `CHANGELOG.md` entry, then
`npx zapier-platform push`, `npx zapier-platform promote <version>` and
`npx zapier-platform migrate <old> <new>`.

### Reviewer access

Zapier's reviewers need a non-expiring iShortn account with paid features enabled, registered to
the address Zapier specifies, plus an API key for it.

## Versioning

Every push needs a new version: bump `version` in `package.json` and add a `CHANGELOG.md` entry.

## License

MIT
