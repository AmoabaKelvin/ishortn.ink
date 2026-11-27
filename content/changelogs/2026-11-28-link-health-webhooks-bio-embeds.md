---
date: 2026-11-28T10:00:00
version: 2.26.0
title: Broken-destination alerts, webhooks, and embed and image blocks for bio pages
shortDesc: Find out when a link's destination stops working, send link and domain events to your own server with signed webhooks, and add videos, music, maps and images to your bio page
category: new
---

## Broken-destination alerts

iShortn now checks your links' destinations once a day, so you hear about a dead page before your visitors do.

Two kinds of links are checked:

- Active links: links on Pro and Ultra that got at least one click in the last 30 days.
- Links attached to a QR code, whether or not they were clicked recently. A dead destination behind a printed code is easy to miss.

Archived, deactivated and blocked links aren't checked.

A link counts as broken after two failed checks in a row. A failed check is a `404` or `410` response, a server error (`5xx`), or no response at all: the domain doesn't resolve, the connection times out, the SSL certificate fails or the redirects never end. Sites that answer but refuse automated visitors (`401`, `403`, `429`, bot challenges) aren't counted as broken.

On Pro and Ultra, broken links show a **Destination down** badge in your links list and on the link's analytics page, with what the last check saw (for example "404 Not Found") and when it ran. You also get one email listing the links that broke, with their clicks from the last 7 days and whether they're on a QR code. You won't get another email for the same link until it has worked again and then breaks again. For team workspaces, the email goes to the team owner.

QR-code links on the Free plan are checked too, so their status shows up as soon as you upgrade.

The emails are part of **Product notification emails** under **Settings > Notifications**. Turn that off and you'll still see the badges.

## Webhooks

Webhooks send an HTTPS `POST` to your server when something changes in a workspace, so your own tools don't have to poll the API. Add an endpoint under **Settings > Webhooks** and choose which events it gets:

- `link.created`: a link is created in the dashboard, with the API or with the browser extension.
- `link.updated`: a link is saved in the link editor or updated with the API.
- `link.deleted`: a link is deleted, one at a time or in bulk.
- `domain.verified`: a custom domain finishes verification and starts serving links.

Each request is signed with your endpoint's secret in an `X-iShortn-Signature` header, so you can check it came from iShortn. **Send test event** sends a sample event to your endpoint, and **View deliveries** shows the last 50 deliveries with the status code your server returned, how long it took and how many times it was retried. Failed deliveries are retried for up to 24 hours. After 20 failures in a row the endpoint is turned off and the workspace owner gets an email.

Webhooks are on Pro (up to 3 endpoints per workspace) and Ultra (up to 10). Team workspaces have their own endpoints, managed by the team's owner and admins. The [webhook docs](/docs/integrations/webhooks) explain the payload and how to verify signatures.

## Embed and image blocks for bio pages

Bio pages have two new block types.

**Embed** adds a YouTube, Vimeo or TikTok video, a Spotify or SoundCloud player, or a Google Map. Paste the full link from the provider and iShortn picks up what it is. Visitors first see a lightweight preview. The provider's player, along with its scripts and cookies, only loads when someone taps it, so embeds don't slow your page down. Short share links such as `vm.tiktok.com` or `maps.app.goo.gl` can't be embedded; use the full URL.

The Free plan includes one embed per bio page, and it doesn't count toward the 3 link blocks. Pro and Ultra have no embed limit.

**Image** adds an uploaded picture (PNG, JPG, GIF or WebP, up to 2 MB) with alt text, and you can make it link anywhere. Clicks on a linked image are tracked like any other bio link, and the link uses one link from your monthly allowance. An image without a link doesn't. Image blocks are on Pro and Ultra.
