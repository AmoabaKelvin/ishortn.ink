---
date: 2026-11-21T20:00:00
version: 2.13.0
title: List your links and check your key through the API
shortDesc: GET /api/v1/links pages through your links newest first, and GET /api/v1/me returns the account behind an API key
category: new
---

The API has two new read endpoints. Both work with the API keys you already have and follow the same plan rules and rate limits as the rest of the API.

## List links

[`GET /api/v1/links`](/docs/api/list-links) returns the links in your personal workspace, newest first, up to 100 per page. Each response has a `nextCursor` for the next page, and `null` on the last one. Creating links while you page through doesn't shift the pages, so you get every link once. Add `domain` to list only the links on one of your domains.

Each link has the same fields as `GET /api/v1/links/{alias}`.

## Check a key

[`GET /api/v1/me`](/docs/api/get-me) returns the account that owns the key: its ID, email, name, plan and default domain. Automation tools call it to test a connection, and you can use it to check that a key works before you rely on it.
