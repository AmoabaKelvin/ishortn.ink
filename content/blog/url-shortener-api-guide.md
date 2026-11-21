---
title: "URL Shortener API: Create, List and Track Short Links in Code"
seoTitle: "URL Shortener API: Compare APIs, With curl"
description: "How a URL shortener API works, with working curl requests and real responses for creating, listing, editing and tracking links, plus how the Bitly, Dub, Short.io and Rebrandly APIs differ."
date: "2026-02-28"
updated: "2026-11-22"
tags: ["api", "developer", "url shortener api", "tutorial"]
published: true
---

A URL shortener API lets your code create short links, change where they point and read their click stats over HTTPS, instead of someone doing it by hand in a dashboard. In almost every service it works the same way: you send a `POST` with the long URL and an API key, and get JSON back with the short link.

```bash
curl https://ishortn.ink/api/v1/links \
  -X POST \
  -H "x-api-key: $ISHORTN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/blog/launch-day", "alias": "launch-day"}'
```

```json
{
  "shortLink": "https://isht.app/launch-day",
  "url": "https://example.com/blog/launch-day",
  "alias": "launch-day",
  "expiresAt": null,
  "activatesAt": null,
  "expiresAfter": null,
  "isProtected": false
}
```

That request uses the iShortn API. The rest of this guide walks through a complete integration with it, with every request and response matching the [API reference](/docs/api). Then it compares how Bitly, Dub, Short.io and Rebrandly do the same things, and ends with what to check before you pick one.

## What people use a shortener API for

- **One link per recipient or order.** Transactional emails, SMS and receipts that each carry their own trackable link.
- **Links created by your product.** A SaaS app that hands users a short share link for a report, an invite or a listing.
- **Bulk jobs.** Shortening a product catalogue or a few hundred campaign URLs from a script.
- **Reporting.** Pulling click counts into your own dashboard, spreadsheet or data warehouse every night.
- **Automation.** Connecting link creation to forms, CRMs and spreadsheets through tools that call HTTP APIs.

## The iShortn API, end to end

Base URL: `https://ishortn.ink/api/v1`. Every endpoint takes and returns JSON.

| Endpoint | What it does |
| --- | --- |
| `GET /api/v1/me` | Return the account that owns the key (use it to test a key) |
| `POST /api/v1/links` | Create a short link |
| `GET /api/v1/links` | List your links, newest first, with cursor pagination |
| `GET /api/v1/links/{alias}` | Get one link |
| `PATCH /api/v1/links/{alias}` | Change its destination, alias, expiry or schedule |
| `DELETE /api/v1/links/{alias}` | Delete it |
| `GET /api/v1/analytics/{alias}` | Click analytics for one link |

### 1. Get a key and check it

API access is part of the Pro and Ultra plans. In the dashboard, open **Settings**, scroll to **API Keys** and click **Create API Key**. The key is shown once, so put it straight into an environment variable or your secret manager:

```bash
export ISHORTN_API_KEY="paste-your-key-here"
```

Every request sends it in the `x-api-key` header. Check that it works with `GET /me`:

```bash
curl https://ishortn.ink/api/v1/me -H "x-api-key: $ISHORTN_API_KEY"
```

```json
{
  "id": "user_2abc123",
  "email": "ada@example.com",
  "name": "Ada Lovelace",
  "plan": "pro",
  "defaultDomain": "isht.app"
}
```

`defaultDomain` is where new links go when you don't pass a `domain`. A wrong or deleted key gets `401` with the code `unauthorized`.

### 2. Create a link

Only `url` is required. Everything else is optional:

| Field | What it does |
| --- | --- |
| `url` | The destination, a full URL including `https://` |
| `alias` | Your own back-half: letters, numbers, `-` and `_`, up to 20 characters. Leave it out for a random 9-character alias |
| `domain` | An iShortn domain such as `isht.app`, or one of your active custom domains |
| `expiresAt` | ISO 8601 date-time after which the link stops redirecting |
| `expiresAfter` | Number of clicks after which the link stops redirecting |
| `activatesAt` | ISO 8601 date-time (with time zone) when the link starts working (Pro and Ultra) |
| `password` | Visitors must enter it before they're redirected (Pro and Ultra) |
| `utmParams` | `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, added to the destination on each visit (Ultra) |

A link on your own domain that switches on at a launch time and switches off after 1,000 clicks:

```bash
curl https://ishortn.ink/api/v1/links \
  -X POST \
  -H "x-api-key: $ISHORTN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/pricing",
    "alias": "pricing",
    "domain": "go.example.com",
    "activatesAt": "2026-12-01T09:00:00Z",
    "expiresAfter": 1000
  }'
```

The response is `201 Created` with the same fields as the example at the top. In JavaScript:

```javascript
const response = await fetch("https://ishortn.ink/api/v1/links", {
  method: "POST",
  headers: {
    "x-api-key": process.env.ISHORTN_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ url: "https://example.com/blog/launch-day" }),
});

if (!response.ok) {
  const { error } = await response.json();
  // error is { code, message, details } for every error except the plan check,
  // where it's a plain string.
  throw new Error(`${response.status}: ${error.message ?? error}`);
}

const link = await response.json();
console.log(link.shortLink); // e.g. https://isht.app/k3x9Qm2Zp
```

And in Python:

```python
import os

import requests

response = requests.post(
    "https://ishortn.ink/api/v1/links",
    headers={"x-api-key": os.environ["ISHORTN_API_KEY"]},
    json={"url": "https://example.com/blog/launch-day", "alias": "launch-day"},
)
response.raise_for_status()
print(response.json()["shortLink"])
```

Every destination goes through a link safety check (known-bad domains, suspicious patterns and Google Safe Browsing) before the link is created. A URL that fails gets `400` with the code `bad_request`.

### 3. List links with cursor pagination

`GET /links` returns your links newest first. `limit` takes 1 to 100 (default 25). Pass the `nextCursor` from one page as `cursor` to get the next; it's `null` on the last page.

```bash
curl "https://ishortn.ink/api/v1/links?limit=2" -H "x-api-key: $ISHORTN_API_KEY"
```

```json
{
  "data": [
    {
      "shortLink": "https://isht.app/launch-day",
      "url": "https://example.com/blog/launch-day",
      "alias": "launch-day",
      "expiresAt": null,
      "activatesAt": null,
      "expiresAfter": null
    },
    {
      "shortLink": "https://go.example.com/pricing",
      "url": "https://example.com/pricing",
      "alias": "pricing",
      "expiresAt": "2026-12-31T23:59:59.000Z",
      "activatesAt": null,
      "expiresAfter": 1000
    }
  ],
  "nextCursor": "MTc5NTI4MDQwMDAwMDo0ODIx"
}
```

The cursor is tied to a position, not a page number, so links you create while paging don't shift later pages or show up twice. To fetch everything:

```javascript
const links = [];
let cursor = null;

do {
  const params = new URLSearchParams({ limit: "100" });
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`https://ishortn.ink/api/v1/links?${params}`, {
    headers: { "x-api-key": process.env.ISHORTN_API_KEY },
  });
  if (!response.ok) throw new Error(`${response.status}`);

  const page = await response.json();
  links.push(...page.data);
  cursor = page.nextCursor;
} while (cursor);
```

Add `domain=go.example.com` to list one domain only.

### 4. Read, update and delete one link

A link is identified by alias and domain together: `isht.app/sale` and `go.example.com/sale` are different links. Pass `?domain=` when the link isn't on your default domain.

```bash
# Read it
curl "https://ishortn.ink/api/v1/links/pricing?domain=go.example.com" \
  -H "x-api-key: $ISHORTN_API_KEY"

# Point it somewhere new and remove the click limit
curl "https://ishortn.ink/api/v1/links/pricing?domain=go.example.com" \
  -X PATCH \
  -H "x-api-key: $ISHORTN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/pricing-2027", "expiresAfter": null}'

# Delete it (204 No Content)
curl "https://ishortn.ink/api/v1/links/pricing?domain=go.example.com" \
  -X DELETE \
  -H "x-api-key: $ISHORTN_API_KEY"
```

`PATCH` accepts `url`, `alias`, `expiresAt`, `activatesAt` and `expiresAfter`; send only what changes, and `null` clears a value. The new destination applies to the next click. Other fields, such as `password` or `domain`, are rejected with `400 validation_failed`; change those in the dashboard.

Deleting is permanent. On iShortn's own domains the alias of a deleted link stays reserved, so a printed QR code or an old post never starts pointing somewhere new.

### 5. Pull click analytics

```bash
curl "https://ishortn.ink/api/v1/analytics/launch-day" -H "x-api-key: $ISHORTN_API_KEY"
```

```json
{
  "totalClicks": 1284,
  "verifiedClicks": 1102,
  "clicksPerDate": { "2026-11-18": 402, "2026-11-19": 517, "2026-11-20": 365 },
  "uniqueClicksPerDate": { "2026-11-18": 311, "2026-11-19": 389, "2026-11-20": 254 },
  "verifiedClicksPerDate": { "2026-11-18": 351, "2026-11-19": 438, "2026-11-20": 313 },
  "clicksPerCountry": { "Ghana": 640, "Nigeria": 391, "United States": 253 },
  "clicksPerCity": { "Accra": 512, "Lagos": 318, "Kumasi": 128 },
  "clicksPerContinent": { "Africa": 1031, "North America": 253 },
  "clicksPerDevice": { "mobile": 902, "desktop": 361, "tablet": 21 },
  "clicksPerOS": { "Android": 611, "iOS": 291, "Windows": 247, "macOS": 135 },
  "clicksPerBrowser": { "Chrome": 803, "Mobile Safari": 288, "Edge": 193 },
  "clicksPerModel": { "Unknown": 853, "iPhone": 291, "SM-A546E": 140 },
  "clicksPerReferrer": { "Direct": 702, "Twitter": 344, "instagram.com": 238 },
  "window": { "days": null, "from": null, "to": "2026-11-20T18:04:11.512Z" }
}
```

Each `clicksPer…` field maps a value to a count. Clicks from known bots aren't recorded. On Pro and Ultra the window is the link's whole history (`days: null`). The country, device and other breakdowns cover the clicks whose detailed data is still kept (365 days on Pro, indefinitely on Ultra); daily totals are kept for good. [Link analytics](/docs/api/link-analytics) documents every field.

Clicks only tell you someone arrived. To see what they did next in GA4 or another analytics tool, tag the destination with UTM parameters. The [UTM builder](/utm-builder) makes the tagged URL, and Ultra can add UTMs per link with `utmParams`.

### Errors and rate limits

Errors come back with an HTTP status and a JSON body you can branch on:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request body is invalid",
    "details": [{ "path": "url", "message": "Enter a valid URL, e.g. https://example.com" }]
  }
}
```

| Status | `code` | Typical cause |
| --- | --- | --- |
| `400` | `bad_request`, `invalid_json`, `validation_failed` | Bad alias, invalid JSON, wrong field type, URL failed the safety check |
| `401` | `unauthorized` | Missing or wrong key |
| `403` | `forbidden` | Domain not on your account, feature not on your plan, monthly link limit reached |
| `404` | `not_found` | No link with that alias on that domain |
| `409` | `conflict` | Alias already taken on that domain |
| `429` | `rate_limited` | Too many requests |

The one exception is a key on an account without Pro or Ultra, which gets `403` with `{"error": "API access requires Pro", "upgrade_url": "https://ishortn.ink/pricing"}`, where `error` is a string.

Rate limits are per account (all your keys share them) and both windows apply:

| Plan | Per minute | Per day | New links per month |
| --- | --- | --- | --- |
| Pro | 300 | 10,000 | 1,000 |
| Ultra | 1,200 | 100,000 | Unlimited |

Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`. A `429` also has `Retry-After` in seconds. Wait that long, then retry:

```javascript
async function withRetry(request, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    const response = await request();
    if (response.status !== 429 && response.status < 500) return response;
    if (attempt === attempts) return response;
    const retryAfter = Number(response.headers.get("Retry-After"));
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}
```

Don't retry a `409` blindly. If the alias is taken, either pick another alias or `GET` the existing link and check whether it already points where you want.

## What the iShortn API doesn't do (yet)

Check these before you build on it.

- **No free API tier.** Keys need Pro ($8 a month) or Ultra ($15 a month). Bitly, Dub, Short.io and Rebrandly all include some API access on their free plans.
- **Personal workspace only.** A key belongs to a person, not a team. Links in a [team workspace](/docs/teams) aren't visible to the API.
- **Not every setting is exposed.** Folders, tags, notes and geo or device targeting rules are dashboard-only for now, and `PATCH` can't change a password or move a link to another domain.
- **No bulk endpoint, webhooks or official SDKs.** Create links one request at a time (within the rate limits above), poll `GET /links` for new ones, and call the API with any HTTP client. For a one-off import of many links, the dashboard takes a [CSV upload](/docs/bulk-import) on Pro and Ultra.
- **Aggregated analytics.** The analytics endpoint returns totals and breakdowns per link, not a raw stream of individual clicks.

## How the Bitly, Dub, Short.io and Rebrandly APIs compare

All five work the same way at heart: a `POST` with a destination and an API key, JSON back. The differences are field names, how you authenticate, and above all what the free plan allows. Checked on each vendor's own docs and pricing pages on November 21, 2026. Prices and limits change, so confirm them before you commit.

| | iShortn | Bitly | Dub | Short.io | Rebrandly |
| --- | --- | --- | --- | --- | --- |
| Create a link | `POST /api/v1/links` | `POST /v4/shorten`, or `POST /v4/bitlinks` for a custom back-half | `POST /links` | `POST /links` | `POST /v1/links` |
| Auth header | `x-api-key: KEY` | `Authorization: Bearer TOKEN` | `Authorization: Bearer dub_...` | `Authorization: KEY` | `apikey: KEY` |
| Destination and alias fields | `url`, `alias` | `long_url`, `keyword` | `url`, `key` | `originalURL`, `path` | `destination`, `slashtag` |
| Short link in the response | `shortLink` | `link` | `shortLink` | `shortURL` | `shortUrl` (no `https://`) |
| Listing links | Cursor (`cursor`, `nextCursor`) | Cursor (`search_after`) | Cursor (`startingAfter`) | Cursor (`pageToken`) | Keyset (`last` = last link ID) |
| API on the free plan | No. Pro or Ultra | Yes: 5 links and 1,000 API requests a month | Yes: 25 new links a month, 60 requests a minute | Yes: 1,000 API-created links for the life of the account | Yes: 10 links a month, 100 calls a minute |
| Click analytics through the API | Pro and Ultra, full link history | Depends on plan; data history starts on Core | Pro plan and up | Statistics endpoint; free plan stats cover the first 50,000 clicks a month | Not verified |
| Official SDKs | None | TypeScript, Android, iOS | TypeScript, Go, Python, Ruby, PHP | Node/TypeScript, Python, Android, iOS | Python |
| Webhooks | None | Enterprise | Business plan and up | Click webhook on Pro | Professional plan and up |

Cheapest plans that unlock more, from the same pages: Bitly Core is $10 a month billed annually ($120 a year) for 100 links and 5,000 API requests a month. Dub Pro is $30 a month ($27 billed yearly) for 1,000 links and 600 requests a minute. iShortn Pro is $8 a month for 1,000 links and 300 requests a minute. Short.io and Rebrandly showed more than one price for the same plan when we checked, so we've left them out; see their pricing pages.

A few differences that matter in practice:

- **Free API for a side project.** Dub and Short.io have the most usable free API tiers. Short.io's 1,000 links are a lifetime allowance, not monthly. Bitly's free plan allows 5 links a month, enough to test the API but not to run anything on it.
- **SDKs and webhooks.** If you want a typed client or click events pushed to your server, Dub and Bitly cover more. iShortn has neither, so you call it with `fetch`, `requests` or `curl` and poll for changes.
- **Redirect type.** Short.io lets you set the redirect code per link (`redirectType`: 301, 302, 307 or 308). iShortn always uses a 307 so destination edits and click counts work on every visit.
- **How links are addressed.** iShortn finds a link by its alias and domain, so the short URL you already have is enough to update it. Bitly addresses a link by its bitlink, such as `bit.ly/abc123`.

For side-by-side feature and price comparisons beyond the API, see iShortn vs [Bitly](/compare/bitly), [Dub](/compare/dub), [Short.io](/compare/short-io) and [Rebrandly](/compare/rebrandly), or the roundups of [Bitly alternatives](/blog/bitly-alternatives) and [Dub alternatives](/blog/dub-alternatives).

## How to choose a URL shortener API

1. **Check the free tier against your real volume.** Count links per month and API calls per day, not just "has an API". A free tier that caps links per month is fine for a side project and a problem for one-link-per-order.
2. **Look at how links are identified.** Some APIs use an opaque ID, others the domain and alias. If you'll update links later, store whatever the API needs to find them again.
3. **Test the edit path.** Changing a destination after the link is printed or sent is usually the reason you wanted an API. Make sure it's available on your plan and that the shortener uses temporary redirects so the change takes effect for everyone.
4. **Read the error format.** Stable machine-readable codes (`conflict`, `rate_limited`) are much easier to handle than free-text messages.
5. **Plan for leaving.** Use a custom domain and keep your own copy of alias and destination pairs. If you switch providers, you can recreate the links on the same domain. The guide to [custom short links for your brand](/blog/custom-short-links-for-your-brand) covers the setup.
6. **Check what happens at the limit.** When you hit a monthly cap or a rate limit, does the API return a clear status and a retry time, and do existing links keep working? On iShortn they do: limits block new links, never redirects.

## Get started

1. [Create an iShortn account](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=url-shortener-api-guide) and upgrade to Pro from [pricing](/pricing).
2. Create a key under **Settings → API Keys**.
3. Run the `GET /me` request above, then create your first link.
4. Keep the [API reference](/docs/api) open for every field, error and limit.

New to short links in general? [What is a URL shortener](/blog/what-is-a-url-shortener) explains redirects, tracking and the risks, and [how to track link clicks](/blog/how-to-track-link-clicks) covers which numbers to report on.
