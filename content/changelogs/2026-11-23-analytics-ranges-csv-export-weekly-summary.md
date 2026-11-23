---
date: 2026-11-23T22:00:00
version: 2.19.0
title: Custom analytics date ranges, click exports, domain moves and a weekly summary email
shortDesc: Pick any date range in analytics, export clicks to CSV, move a link to another domain without breaking the old URL, and get a Monday email with last week's clicks
category: new
---

Several changes to analytics, links, email and billing.

## Custom date ranges and Last month in analytics (Pro and Ultra)

The date range picker on link, QR code and overview analytics now has **Last month** and **Custom range**. Custom range opens a calendar: pick a first and last day and the page updates. A single day is shown hour by hour.

The range is saved in the page URL, so you can share or bookmark a view and the Back button returns to the range you had before. Days are whole days in UTC, the same as the charts.

Free plans keep the 7-day view. More in the [analytics guide](/docs/analytics).

## One source per platform in referrers

Visits from the different addresses of the same platform are now grouped under one source. For example, facebook.com, m.facebook.com, l.facebook.com and fb.me all show as **Facebook**. This applies to X (including twitter.com and t.co), Facebook, Instagram, LinkedIn, Google (every country domain), YouTube, Reddit and WhatsApp, and to visits from their Android apps.

**For API users:** the `clicksPerReferrer` keys for these platforms change to the new names. For example, `Twitter` becomes `X` and `instagram.com` becomes `Instagram`.

## Export clicks to CSV (Pro and Ultra)

**Export CSV** sits next to the date range selector on a link's analytics page and on the analytics overview. It downloads every click in the selected range (and overview filter), newest first, with these columns: timestamp (UTC), short link, destination, country, city, device, browser, OS and referrer.

One export holds up to 100,000 clicks. If a range has more, you get the newest 100,000 and a note to pick a shorter range. Clicks older than your plan's retention period are kept only as daily totals, so they aren't in the file. See [Export](/docs/analytics#export).

## Move a link to another domain without breaking the old URL

The domain picker in the edit drawer now works: choose a different domain for a link and save. The old short URL keeps redirecting to the link, and its clicks count toward the same link. A hint under the field shows which old URL will keep working.

The alias has to be free on the new domain. If it's taken, you'll be asked to pick a different alias or domain.

The API supports this too: `PATCH /api/v1/links/{alias}` now accepts `domain`. See [Update a link](/docs/api/update-link).

## Weekly "your links this week" email

On Mondays, accounts whose links got at least 5 clicks in the previous week (Monday to Sunday, UTC) get a short summary: total clicks compared with the week before, the top 3 links, the top country and the top source, with a button to your analytics. It covers links in your personal workspace, not QR codes or bio pages.

To stop it, turn off the **Weekly summary** switch under **Settings > Notifications**, or use the unsubscribe link at the bottom of the email. That link opens a page with one **Unsubscribe** button and doesn't need you to sign in.

## Smoother upgrade checkout

- Pressing Back from checkout returns you to the pricing page with your plan still selected, instead of opening a new checkout.
- During a promotion, **Settings > Billing** shows the promo price for upgrades, with the regular price struck through.
