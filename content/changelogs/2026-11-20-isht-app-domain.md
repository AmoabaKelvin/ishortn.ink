---
date: 2026-11-20T18:00:00
version: 2.9.0
title: Meet isht.app
shortDesc: isht.app is the new default domain for short links. isht.ink and ishortn.ink still work
category: new
---

New short links now default to **isht.app**. It's a new domain that only serves over HTTPS. `isht.ink` and `ishortn.ink` keep working exactly as before.

## What's new

The domain dropdown on new links, QR codes and link edits now lists `isht.app`, `isht.ink` and `ishortn.ink`. New links start on `isht.app`, and you can pick any of the three for each link. The API and CSV import accept `isht.app` too.

## Your existing links

Nothing changes. Every link you've made on `isht.ink` or `ishortn.ink` still opens at the same URL. Printed QR codes, links in bios and anything else you've already shared keep working.

## Teams

Team workspaces stay where they are: a team with slug `acme` is still at `acme.isht.ink` and `acme.ishortn.ink`. Team links can use `isht.app` like any other link.

## Picking a default

If you saved a default domain in [Settings → General](/dashboard/settings/general), the API keeps using it until you change it. `isht.app` is now one of the options there.
