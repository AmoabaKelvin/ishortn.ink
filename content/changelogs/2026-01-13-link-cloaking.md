---
date: 2026-01-13T12:00:00
version: 1.7.0
title: Link Cloaking
shortDesc: Keep your short URL visible in the browser while displaying destination content
category: feature
---

Your short links just got more powerful. With link cloaking, the destination website appears while your branded short URL stays in the browser's address bar—giving you complete control over how your links look when clicked.

## What's new?

When you create or edit a link, you'll find a new "Link Cloaking" toggle. Enable it, and visitors will see your short URL (like `go.yourbrand.com/promo`) in their browser even while viewing the destination content.

### How it looks

Without cloaking:
- User clicks `go.yourbrand.com/promo`
- Browser shows `www.landing-page.com/campaign/summer-2026`

With cloaking:
- User clicks `go.yourbrand.com/promo`
- Browser shows `go.yourbrand.com/promo` while displaying your landing page

## Why this matters

Standard redirects expose your destination URL, which can look unprofessional or dilute your branding. Link cloaking solves this:

- **Brand reinforcement** — Your custom domain stays visible throughout the user's visit
- **Cleaner URLs** — Hide long, complex destination URLs with tracking parameters
- **Professional appearance** — Present a polished, consistent brand experience
- **Affiliate marketing** — Keep your branded URL visible instead of revealing affiliate links

## How it works

When someone clicks a cloaked link, instead of redirecting them to the destination, we display the destination content within a seamless full-screen frame. The short URL remains in the address bar while the visitor interacts with the destination page normally.

Social media crawlers still see your custom metadata (if configured), so link previews work exactly as expected.

## Compatibility check

Not all websites can be cloaked. Some sites have security policies that prevent them from being displayed within frames. When you enable cloaking, we automatically check if your destination URL is compatible:

- **Compatible** — Cloaking will work as expected
- **Not compatible** — The site blocks framing; you'll see a warning and cloaking will be disabled for that link

Common sites that block framing include banking sites, Google properties, and some social media platforms. If you see a compatibility warning, consider using standard redirects instead.

## Editing existing links

Want to add cloaking to your existing links? Open the edit drawer for any link and toggle on "Link Cloaking." The change takes effect immediately—no need to create new links.

## Who can use this?

Link cloaking is available exclusively on the **Ultra** plan. Enable it when [creating a new link](/dashboard/link/new) or by editing any existing link in your dashboard.
