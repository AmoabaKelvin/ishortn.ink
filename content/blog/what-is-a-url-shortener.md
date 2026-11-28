---
title: "What Is a URL Shortener and How Does It Work?"
description: "A URL shortener maps a short code to a long URL and redirects visitors to it. How redirects work, 301 vs 302 vs 307, what gets tracked, custom domains, and the risks."
date: "2026-03-08"
updated: "2026-11-22"
tags: ["url shortener", "link management", "guide", "redirects"]
published: true
---

A URL shortener is a service that gives a long web address a short alias, such as `isht.app/launch-day`, and sends anyone who opens the short version on to the original page. It doesn't compress the URL. It stores a pair (short code, long URL) in a database, and when someone requests the short code, its server answers with an HTTP redirect that points the browser at the long URL.

Because every click passes through the shortener's server on the way, the service can count clicks, change where the link goes after you've shared it, and put the link on your own domain. That's why people use them, and it's also where the risks come from.

This guide covers how a short link works step by step, which redirect codes shorteners use and why it matters, what a shortener can and can't track, custom domains, and the problems to watch for: dead links, phishing and spam filters.

## A short link, before and after

| | Example |
| --- | --- |
| Long URL | `https://example.com/products/winter-2026/limited-edition?utm_source=newsletter&utm_medium=email&utm_campaign=launch` |
| Short link | `https://isht.app/winter26` |
| Branded short link | `https://go.example.com/winter26` |

All three open the same page. The short ones fit in a text message, read out loud on a podcast, and print cleanly on a flyer.

## How a URL shortener works

### Creating the link

1. You paste a long URL into the shortener, or send it to the shortener's API.
2. The service checks the destination. Responsible shorteners refuse known phishing and malware URLs at this step.
3. It picks a short code, also called a slug, alias or back-half. That's either a random string, like a 9-character code, or one you choose, like `winter26`. The code has to be unique on that domain.
4. It saves the pair in its database and gives you the short link.

### When someone clicks it

1. The visitor's browser looks up the shortener's domain in DNS and connects to its server.
2. It requests the path, for example `GET /winter26`.
3. The server finds `winter26` in its database. If the link is expired, disabled or blocked, it shows a page explaining that instead.
4. It records the click: time, approximate location from the IP address, device and browser from the user agent, and the referring site if the browser sends one.
5. It responds with a redirect status code and a `Location` header holding the long URL.
6. The browser makes a second request, to the destination, and loads the page.

You can watch this happen with `curl`. Here is the response for an iShortn link, with the destination cut short to fit:

```bash
$ curl -I https://isht.app/winter26
HTTP/2 307
location: https://example.com/products/winter-2026/limited-edition?...
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
```

The detour costs the visitor one extra request before the real page starts loading.

## 301 vs 302 vs 307: which redirect a shortener should use

The status code tells the browser, and search engines, whether the move is permanent and whether to remember it.

| Code | Meaning | Browser caches it? | Keeps the request method? | Google treats target as canonical? |
| --- | --- | --- | --- | --- |
| `301` | Moved permanently | Yes, often indefinitely | Not guaranteed | Yes |
| `308` | Permanent redirect | Yes | Yes | Yes |
| `302` | Found (temporary) | No, unless told to | Not guaranteed | No |
| `307` | Temporary redirect | No, unless told to | Yes | No |

Two things follow for short links.

**A cached 301 breaks editing and counting.** Once a browser has cached a 301, it can skip the shortener on the next visit and go straight to the old destination. If you later change where the link points, that visitor never sees the change, and the click is never recorded. Temporary redirects (302 and 307) avoid both problems, which is why most link-tracking shorteners use them.

**For SEO it rarely matters.** Google's [redirect documentation](https://developers.google.com/search/docs/crawling-indexing/301-redirects) says permanent redirects (301, 308) are a signal that the target should be the canonical URL, while temporary ones (302, 303, 307) are not. A short link you share on social media or in an email isn't a page you want ranked, so a temporary redirect is the right choice. For moving your own website to a new address, use a 301 on your own server, not a short link.

iShortn answers short links with a `307` and a `no-store` cache header, as the `curl` output above shows. Every click reaches the server and gets counted, and a changed destination applies to the next visitor.

## What a URL shortener can and can't track

Because the click passes through its server, a shortener can record:

- **When**: the time of each click, which gives you clicks per day.
- **Where**: country and city, estimated from the IP address. This is approximate, and VPNs move it.
- **What device**: mobile, tablet or desktop, plus operating system and browser, read from the user agent.
- **Where from**: the referring site, when the browser sends one. Many apps (WhatsApp, email clients, some social apps) send none, so those clicks show up as "Direct".
- **Unique visitors**: an estimate of how many different people clicked, not just total clicks.

A good shortener also filters out known bots and link-preview crawlers, so the preview card Slack or iMessage fetches doesn't count as a click.

It can't see who the person is, and it can't see what they do after they land: whether they bought anything, read the page or bounced. For that, add UTM parameters to the destination so your own analytics such as GA4 or Plausible can attribute the visit. The free [UTM builder](/utm-builder) builds the tagged URL, and [how to track link clicks](/blog/how-to-track-link-clicks) explains which numbers are worth watching.

On iShortn, the Free plan shows a 7-day analytics window. Pro and Ultra show a link's whole history. See [Analytics](/docs/analytics) for what each chart counts.

## Custom domains: short links on your own brand

By default, your links live on the shortener's domain (`isht.app/winter26`, `bit.ly/...`). With a custom domain they read `go.yourbrand.com/winter26`. Setting one up means adding a DNS record, usually a `CNAME`, that points a subdomain at the shortener. The shortener then issues an SSL certificate for it. The [custom domain docs](/docs/custom-domains) walk through it.

Why bother:

- **People can see who sent the link.** A generic short link hides the destination. `go.yourbrand.com` tells the reader the link is yours before they click.
- **You don't inherit other people's reputation.** A shared shortener domain carries links from every user, including spammers, so some email filters and security tools treat it with suspicion. Your own domain only carries your links.
- **You can leave.** If you own the domain, you can move it to another provider and recreate the links. If your links live on the shortener's domain, they work only as long as that shortener does.

The cost is a domain you own and, on most services, a paid plan. On iShortn, Pro includes 3 custom domains and Ultra has no limit. The guide to [custom short links for your brand](/blog/custom-short-links-for-your-brand) covers naming and setup.

## Short links and QR codes

A QR code stores a URL. If it stores your long destination directly, it can never change: reprint the code or live with it. If it stores a short link, you can change the destination later and the printed code keeps working. That's what "dynamic QR code" means in practice, and it also makes scans countable, because each scan is a click on the short link.

The catch is the same as above: the printed code depends on the shortener staying up and the link staying active. If a code on a menu or flyer stops working, [this troubleshooting guide](/blog/qr-code-stopped-working) lists the usual causes. You can make a code for any link with the free [QR code generator](/qr-code-generator).

## The risks and limits of short links

### Link rot when a service shuts down or changes its rules

A short link has two points of failure: the destination page and the shortener. If the shortener closes, every link on its domain dies, no matter how healthy the destination is.

Google ran goo.gl for years, then [announced in 2024](https://developers.googleblog.com/en/google-url-shortener-links-will-no-longer-be-available/) that all goo.gl links would stop working on August 25, 2025. It softened that in August 2025: links that showed no activity were switched off on that date, and actively used links were kept. Firebase Dynamic Links, Google's app-link product on `page.link`, shut down on the same day.

How to protect yourself:

- Use a custom domain for anything printed or long-lived, so you can move providers.
- Export your links now and then. A list of alias and destination pairs lets you rebuild them elsewhere.
- Check what the provider does with inactive or free links. Some disable links with no recent clicks.
- Don't reuse aliases for something new. On iShortn's own domains, a deleted link's alias can't be claimed again, so an old printed code never starts pointing somewhere unexpected.

### Phishing: short links hide where they go

The thing that makes short links tidy also makes them useful to scammers: you can't read the destination before you click. Shorteners are a common way to dress up phishing pages, which is why some email filters and chat apps distrust links on shared shortener domains.

As a reader, before you click a short link from someone you don't know:

- Preview it. Many shorteners show the destination if you change the URL slightly. On iShortn, add `!` to the end of the link (`isht.app/winter26!`) to see where it goes without being redirected or counted as a click. Unshortening sites such as [unshorten.it](https://unshorten.it) work across services.
- Prefer links on a domain you recognise, which is another argument for branded links.

As a shortener user, pick a service that scans destinations. iShortn checks every destination when a link is created or edited, including Google Safe Browsing and its own blocklists, and re-checks live links against threat feeds several times a day ([details](/docs/abuse#link-safety-checks)). No scanner catches everything. A brand-new phishing page can get through until a threat list picks it up.

### Destinations can change after you share

A link you can edit is a link someone else can edit too, if they run it. For the reader, a short link that pointed somewhere harmless last week can point somewhere else today. For you, it means protecting the account that owns your links: use a strong password, and on a team give edit access only to people who need it.

### When not to use a short link

- **Links on your own website to your own pages.** Link directly. A redirect adds a hop and tells search engines nothing useful.
- **Places that reject them.** Some ad networks, affiliate programs and forums ban or flag shortened links. Read the rules first.
- **URLs that are already short.** `example.com/pricing` doesn't need shortening, though you may still want a short link to count clicks.

## Free vs paid URL shorteners

Most shorteners have a free plan that covers basic shortening, with caps on links per month and on how far back analytics go. Paid plans usually add custom domains, editable links, longer analytics history, API access and team features.

For reference, iShortn's Free plan includes 30 new links a month, 1,000 tracked clicks (including scans) a month, a 7-day analytics window and up to 5 QR codes. Pro is $8 a month (1,000 links and 10,000 tracked clicks a month, 3 custom domains, the [API](/docs/api) and password protection). Ultra is $15 a month, removes the link, tracked-click and domain caps, and adds team workspaces. Full limits are on the [plans page](/docs/plans) and [pricing](/pricing).

If you're choosing between services, the [comparison of free URL shorteners](/blog/best-free-url-shorteners) lines up the free plans, and the [compare pages](/compare) go through iShortn against [Bitly](/compare/bitly), [TinyURL](/compare/tinyurl), [Rebrandly](/compare/rebrandly) and [Dub](/compare/dub) one by one. If you're not sure you need more than a shortener, read [URL shortener vs link management platform](/blog/url-shortener-vs-link-management-platform).

## Frequently asked questions

### Are URL shorteners safe?

The shortener itself is as safe as the page it sends you to. The risk is that you can't see that page before clicking. Preview unfamiliar short links, and treat a short link from a stranger the way you'd treat any unknown link.

### Do short links expire?

Not usually. Most services keep links working indefinitely unless you set an expiry date or click limit, delete the link, or the service shuts down. Some free services disable links that go unused; check the provider's terms. On iShortn, links don't expire unless you set an expiry date or a click limit, and inactive links aren't switched off.

### Does a short link hurt SEO?

Not for the ways people normally use them: social posts, email, print and chat. Google follows redirects. Don't use short links for internal links on your own site, and don't expect a short link to rank in search on its own.

### Can I change where a short link goes after sharing it?

On most link-management services, yes. That's the main reason to use a shortener that uses temporary redirects. On iShortn you can edit the destination of any link on every plan, from the dashboard or through the API on Pro and Ultra.

### What happened to Google's URL shortener?

Google stopped creating new goo.gl links in 2019. On August 25, 2025, it switched off goo.gl links that showed no activity in late 2024. Links that were still in use keep working.

### How do I make a short link?

Paste the long URL into a shortener, optionally choose your own alias, and copy the result. On iShortn:

1. [Create a free account](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=what-is-a-url-shortener).
2. Paste the long URL and, if you like, type an alias such as `winter26`.
3. Copy the short link, or download a QR code for it.
4. Open the link's analytics to see clicks by day, country, device and referrer as they come in.
