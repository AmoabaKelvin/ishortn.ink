---
title: "Old Bitly Links Were Hijacked. Can Your Short Links Be Taken Over?"
seoTitle: "Bitly Links Hijacked: What Happened and What to Do"
description: "Old bit.ly links in Burger King, McDonald's and Trump posts were re-registered by strangers. What happened, why it can happen, and how to keep your short links yours."
date: "2026-11-27"
author: "Kelvin Amoaba"
tags: ["bitly", "link security", "url shortener", "qr code", "custom domain"]
published: true
---

On 15 November 2026, a 2011 Burger King tweet about a restaurant locator started sending people to a Wikipedia list of Nazi concentration camps. A McDonald's tweet from the same year now opened the Wikipedia article on the September 11 attacks. Neither account had been hacked. The bit.ly links inside the tweets had been created again by someone else, with new destinations.

If you've ever put a short link in a post, an email or on a printed QR code, the obvious question is whether this can happen to yours. This guide covers what we know, what's still unclear, and a checklist you can work through in an afternoon.

We make iShortn, a link shortener, so we have an interest here. Everything about Bitly below comes from Bitly's own statement and from published reporting, linked in each section. Where nobody knows something yet, we say so.

## What happened

[Ransomnews](https://ransomnews.com/burger-king-tweet-bitly-link-hijack-2026/) checked Bitly's own link information pages. They showed that the Burger King link, `bit.ly/19BFiM`, was registered again at 05:32 UTC on 15 November, and the McDonald's link, `bit.ly/mLWJO0`, at 05:14 UTC. Ransomnews also went through 97 Bitly links in Donald Trump's tweets from 2009 to 2013 and found 7 that led somewhere other than the tweet suggested, including lookalike crypto domains. [CNN](https://www.cnn.com/2026/11/15/business/political-and-corporate-x-posts-have-links-redirecting-to-vulgar-racist-or-random-websites) reported affected posts from Bill Gates, Justin Trudeau, Mike Pence and the FBI.

Bitly confirmed the problem the same day [on X](https://x.com/Bitly/status/2122045450786152588):

> "Earlier today, we identified an issue that allowed bad actors to repurpose certain old, inactive links to redirect people to content unrelated to the original posts. We have suspended the accounts involved and are disabling the affected links."

By that evening the Burger King and McDonald's links showed Bitly's "Link Deactivated" page. The story reached the front page of [Hacker News](https://news.ycombinator.com/item?id=50511395) with 380 points.

## What we don't know yet

Bitly hasn't said how many links were affected or exactly how the old links became available again. Ransomnews points out that Bitly's help center says a back-half (the part after `bit.ly/`) can't be re-used, and the creation dates show that it was, at least for these links. Some reports connect it to accounts that went inactive and were removed, but Bitly hasn't confirmed that. A similar takeover of old Trump links in February 2025 pointed to memecoin pages.

The examples from 15 November were pranks. The same trick would work for a fake login page or a scam, and that's the part worth planning for.

## Why this can happen with any shared short domain

A short link is a row in somebody's database that says "this ending goes to that address". On a shared domain like `bit.ly`, every user draws from the same pool of endings. If a link is deleted, expires or disappears with an old account, its ending can look free to the system. Whoever claims it next decides where every old copy of that link goes: the tweets, the PDFs, the QR codes on packaging.

You can't edit a tweet from 2011 or reprint 10,000 flyers, so the old copies stay out there. The shortener is the only thing standing between them and a stranger, and that depends on its policy for freed endings.

Your own domain changes this. If your links live on `go.yourbrand.com`, nobody else can create a link there, because only you control the domain. The risk moves to something you can manage yourself: keeping the domain renewed.

## Checklist: protect the short links you've already published

1. **Find your old short links.** Download your X archive (Settings and privacy, then Your account, then "Download an archive of your data") and search it for `bit.ly`, `tinyurl.com`, `ow.ly` and any other shortener you've used. Do the same for your newsletter archive, old PDFs and anything printed.
2. **Check where each one goes now, without visiting it.** On Bitly, add `+` to the end of a link (for example `bit.ly/19BFiM+`) to see its destination and creation date. If the creation date is later than your post, someone else made it. On iShortn, add `!` to the end of any short link to see where it goes before you open it.
3. **Fix what you can.** Delete or reply to posts with hijacked links, edit posts where the platform allows it, and ask partner sites to update links that point to you. Report a hijacked Bitly link to Bitly so they can disable it.
4. **Put new links on a domain you own.** A short subdomain such as `go.yourbrand.com` or `link.yourshop.com` works. Bitly, Rebrandly, Short.io, Dub and iShortn all support custom domains, usually on a paid plan.
5. **Point QR codes at a domain you control.** A dynamic QR code is a short link in a pattern, so it carries the same risk. For anything printed, use your own domain, or use a static QR code that encodes your own URL directly.
6. **Keep your domains and accounts alive.** Turn on auto-renew for every domain behind your links and QR codes. An expired domain can be bought by anyone, and then they control every link on it. Keep the account that owns your links active, and write down which account owns what.
7. **Check your most important links every few months.** Five minutes with the `+` or `!` preview on your top links catches problems before customers do.

## What we do at iShortn

We shipped a fix for the reissue problem on 21 November, a few days after this story broke. Here's exactly what it covers, and what else already worked this way.

- **Deleted links on our shared domains are never reissued.** Since 21 November 2026, when you delete or rename a link on our shared short domains, such as `ishortn.ink` and `isht.app`, we retire that ending permanently. Nobody can create a new link with it later, and the same applies when an account or team workspace is removed. Links deleted before that date aren't covered by the rule.
- **On your own domain, the links are yours.** Only the domain's owner can create links on a custom domain. You can export your links as CSV or JSON at any time, so if you leave iShortn you can point the domain at another service and recreate the same addresses there.
- **Previews before clicking.** Add `!` to any iShortn short link to see the destination without being redirected, and the visit doesn't count as a click.
- **QR codes don't expire.** Free includes 5 dynamic QR codes that you can edit at any time, and they keep working if you never upgrade.

iShortn is also open source, so you can [self-host it](/docs/self-hosting) if you'd rather run the database yourself. YOURLS, Kutt and Shlink are other good self-hosted options. If you want to stay on Bitly, the fix is the same: move your important links to a branded domain you own.

## If you're moving from Bitly

You can't take `bit.ly` links with you, because Bitly owns that domain. Those links keep working as long as Bitly keeps them. If you already use a branded domain on Bitly, you can move it with the exact same addresses, so printed QR codes keep working. [Move your links from Bitly](/docs/migrate-from-bitly) covers the export, the DNS change and the import.

For a side-by-side look, see [iShortn vs Bitly](/compare/bitly), [the best Bitly alternatives](/blog/bitly-alternatives) and [Bitly's free plan limits](/blog/bitly-free-plan-limits).

## FAQ

### Were Bitly accounts hacked?

No. Ransomnews found nothing posted from the Burger King or McDonald's accounts, and Bitly described the problem as old, inactive links being repurposed. The X accounts themselves were fine.

### Are Bitly links safe to click?

Most are. Before opening one you don't trust, add `+` to the end to see where it goes and when it was created.

### Can someone take over a link on my own custom domain?

Not through the shortener, because only you can create links on your domain. The risk is the domain itself: if its registration lapses and someone else buys it, they control every link on it. Turn on auto-renew.

### Do iShortn links expire?

Only if you set an expiry date or click limit yourself. Free links and QR codes have no time limit.

## Try iShortn

You can [create a free iShortn account](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=bitly-link-hijacking) and make your first links and QR codes in a couple of minutes. When you want links on your own domain, [Pro is $8 a month](/pricing).
