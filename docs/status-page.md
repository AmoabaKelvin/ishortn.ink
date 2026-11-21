# Status page

[status.ishortn.ink](https://status.ishortn.ink) is an [Upptime](https://upptime.js.org) site
served from the public `ishortn-status` repository. GitHub Actions run the checks every 5 minutes,
open an issue for each outage (the incident history) and publish the page to GitHub Pages. Nothing
in this repository runs it; the checks only call public URLs.

## Checks

| Check                     | Request                                | Up when                                   |
| ------------------------- | -------------------------------------- | ----------------------------------------- |
| Website                   | `GET https://ishortn.ink/`             | `200`                                     |
| Short links (isht.app)    | `GET https://isht.app/status-check`    | `301`/`302`/`307`/`308`, not followed     |
| Short links (ishortn.ink) | `GET https://ishortn.ink/status-check` | `301`/`302`/`307`/`308`, not followed     |
| Sign-in                   | `GET https://ishortn.ink/auth/sign-in` | `200`                                     |
| API                       | `GET https://ishortn.ink/api/v1/me`    | `401` with `"code":"unauthorized"` (JSON) |
| Database                  | `GET https://ishortn.ink/api/health`   | `200` with `"ok":true`                    |

`/api/health` is public: it runs `SELECT NOW()` through Hyperdrive with a 2 s timeout and answers
`200 {"ok":true}` or `503 {"ok":false}`, nothing else. The detailed, token-protected check stays at
`/api/health/deep`.

## Canary links

The short-link checks request two canary links that belong to an internal account:

- `isht.app/status-check` → `https://ishortn.ink/`
- `ishortn.ink/status-check` → `https://ishortn.ink/`

**Never delete, rename, block or edit these links.** They must stay plain redirects: no password,
expiry, click limit, geo rules, cloaking or bot verification. Deleting one also reserves its alias
for good, so the check would need a new alias in `.upptimerc.yml`.

The canary checks send a `curl/…` user agent, which the click recorder drops as a bot, so the
checks still exercise link resolution without adding clicks to the internal account.

## Setup

1. Create the public repository `ishortn-status` from the
   [upptime/upptime](https://github.com/upptime/upptime) template ("Use this template", include
   all branches).
2. Add a repository secret `GH_PAT`: a fine-grained token for that repository with read and write
   access to Actions, Contents, Issues and Workflows
   ([Upptime docs](https://upptime.js.org/docs/get-started)). Checks stop when the token expires,
   so choose a long expiry and renew it before then.
3. Replace `.upptimerc.yml` with the file below and commit. The "Setup CI" workflow then generates
   the workflows, `README.md` and the site.
4. Enable GitHub Pages from the `gh-pages` branch. Once the certificate is issued, turn on
   "Enforce HTTPS".
5. In Cloudflare DNS for `ishortn.ink`, add `CNAME status` → `<owner>.github.io` as **DNS only**
   (grey cloud). The explicit record wins over the `*.ishortn.ink` wildcard, so the Worker no
   longer receives the host.
6. Create the two canary links above from the internal account.

## `.upptimerc.yml`

Set `owner` to the account or organisation that owns the repository.

```yaml
owner: <owner>
repo: ishortn-status

sites:
  - name: Website
    url: https://ishortn.ink/
    expectedStatusCodes: [200]
    maxRedirects: 0
  - name: Short links (isht.app)
    url: https://isht.app/status-check
    expectedStatusCodes: [301, 302, 307, 308]
    maxRedirects: 0
    # A curl user agent is dropped as a bot, so checks add no clicks to the canary.
    headers:
      - "User-Agent: curl/8 (iShortn status check; +https://status.ishortn.ink)"
  - name: Short links (ishortn.ink)
    url: https://ishortn.ink/status-check
    expectedStatusCodes: [301, 302, 307, 308]
    maxRedirects: 0
    headers:
      - "User-Agent: curl/8 (iShortn status check; +https://status.ishortn.ink)"
  - name: Sign-in
    url: https://ishortn.ink/auth/sign-in
    expectedStatusCodes: [200]
    maxRedirects: 0
  - name: API
    url: https://ishortn.ink/api/v1/me
    expectedStatusCodes: [401]
    maxRedirects: 0
    __dangerous__body_down_if_text_missing: '"code":"unauthorized"'
  - name: Database
    url: https://ishortn.ink/api/health
    expectedStatusCodes: [200]
    maxRedirects: 0
    __dangerous__body_down_if_text_missing: '"ok":true'

workflowSchedule:
  uptime: "*/5 * * * *"

status-website:
  cname: status.ishortn.ink
  logoUrl: https://ishortn.ink/icon.png
  name: iShortn status
  introTitle: "**iShortn** service status"
  introMessage: Live status of iShortn's short links, website, sign-in, API and database. Checks every 5 minutes.
  navbar:
    - title: Status
      href: /
    - title: iShortn
      href: https://ishortn.ink
```
