---
title: "QR Codes on Your Own Domain: How Custom Domain QR Codes Work and What They Cost"
seoTitle: "QR Code Generator With a Custom Domain (2026)"
description: "Why a dynamic QR code should run on your own domain (or your client's), what happens to the codes when you leave a QR vendor, which tools offer custom domains at what price, and how to set one up."
date: "2026-12-18"
author: "Kelvin Amoaba"
tags: ["qr code", "custom domain", "agencies", "branding", "guide"]
published: true
---

Scan a dynamic QR code and look at the address your phone shows before it opens. Most of the time it isn't the company's website. It's the QR vendor's short domain, something like `qrco.de/bfXz12` or `hov.to/3k9`.

That causes two problems. People are less willing to open a link from a domain they've never heard of. And every printed code depends on that vendor: if the subscription lapses, the account gets lost or the vendor shuts down, the codes stop working and nobody can fix them without reprinting.

A custom domain fixes most of this. The code says `qr.yourbrand.com/menu` instead, and the domain belongs to you. This guide explains how that works, what it does and doesn't protect you from, which tools offer it at what price, and how agencies should handle it for clients.

We make iShortn, a link shortener with dynamic QR codes on custom domains. We include other tools' prices so you can compare.

## How a custom domain QR code works

A dynamic QR code doesn't contain your destination. It contains a short link. When someone scans it, the QR service looks up where that short link should go and redirects them. That's why you can change the destination after printing and count scans.

With a custom domain, that short link uses a subdomain you own, such as `qr.yourbrand.com`. You add a DNS record (usually a CNAME) that points the subdomain at the QR service, and the service answers for it. Your main website, `yourbrand.com`, isn't touched, and neither is your email.

People scanning see your domain in the preview. The redirect works the same way it would on the vendor's domain. Short links work the same way; our guide to [custom short links for your brand](/blog/custom-short-links-for-your-brand) covers them.

## What it protects you from, and what it doesn't

A custom domain doesn't make a code immortal. If you cancel the service that answers for `qr.yourbrand.com`, the codes stop resolving until something else answers for it.

The difference is that you can fix that, because the domain is yours. Point the subdomain at another service, create the same paths (`/menu`, `/x200`, `/spring`) with the same destinations, and every printed code works again. A code on the vendor's domain can't be moved like that. The vendor controls the domain, so if the vendor goes, the code goes with it.

To make that move possible later, you need three things:

- **The domain itself**, registered to the company and set to auto-renew. If a domain lapses and someone else registers it, your printed codes send people to them. We cover this in [why QR codes stop working](/blog/qr-code-stopped-working).
- **A list of every path and destination.** Make sure your tool can export it.
- **A tool that keeps the codes running when you change plans.** Check this before you print. Hovercode's [pricing FAQ](https://hovercode.com/pricing/), for example, says that if you cancel, "any QR codes, short links, or pages using your custom domain will stop working", and that they're reactivated if you resubscribe.

## Which QR tools offer custom domains, and at what price

Custom domains are usually a paid feature, and several QR platforms keep them for their higher plans. These are the cheapest plans that include one, from each vendor's own pricing page on 22 November 2026:

| Tool | Cheapest plan with a custom domain | Domains on that plan | Notes |
|---|---|---|---|
| iShortn | Pro, $8/month or $80/year | 3 | Unlimited QR codes; Ultra ($15) has unlimited domains |
| Hovercode | Pro, €11/month | 1 | 100 dynamic QR codes in total; Business (€37) has 10 domains |
| Scanova | Pro, $75/month billed annually | 1 | 5 users, 500 QR codes; extra domains $120/year each |
| Uniqode | Plus, $99/month billed yearly | Listed as "Custom domain" | 3 users, 500 dynamic QR codes |

Sources: [Hovercode pricing](https://hovercode.com/pricing/) (it showed prices in euros when we checked), [Scanova pricing](https://scanova.io/pricing), [Uniqode pricing](https://www.uniqode.com/pricing). Prices change, so check before you buy.

The pricier plans come with more users and more QR-specific tools: landing page builders, forms, ad-platform integrations, and on Uniqode's top tier SSO and a dedicated customer success manager. Some teams need those. If what you need is codes on your own domain, you don't have to pay $75 to $99 a month for it.

## Agencies: put client codes on the client's domain

If you make QR codes for clients, the domain question is also an ownership question. Codes on your agency's account and your vendor's domain tie the client's printed material to you. When the contract ends, the client either keeps paying you or reprints. Neither option will feel fair to them, and it's a bad way to end a client relationship.

A setup that holds up better:

1. **Use a subdomain of the client's domain**, such as `go.clientbrand.com`. The client keeps control of the DNS. Their IT person or registrar adds one CNAME record, which doesn't touch their website or email.
2. **Keep each client separate.** One workspace or folder per client, so their codes, domains and scan numbers don't mix with anyone else's.
3. **Write down who owns the codes**, in the proposal or contract. For long-lived print (packaging, signage, vehicle graphics) the client should own them. For a one-off campaign with an end date, it matters less.
4. **Plan the handover.** When the work ends, the client needs the codes and their paths moved to an account they control, or an export they can rebuild from. Because the domain is theirs, nothing they've printed has to change.

In iShortn, Ultra lets you create a team workspace for each client and invite the client as a member. Members don't need a paid plan of their own, and there's no limit on members. At the end of a contract you can transfer the workspace to the client (the new owner needs an Ultra plan and must already be a member), or move the links into another workspace you both belong to, up to 100 at a time. QR codes move with their links. On Pro, 3 custom domains and folders cover a freelancer with a few clients. There's more on this in [QR codes and short links for agencies](/solutions/agencies).

## Companies: one subdomain for everything you print

For a company, the simplest setup is one subdomain, such as `qr.yourcompany.com` or `go.yourcompany.com`, used on every printed thing: packaging, manuals, spec sheets, trade show graphics, business cards. Use short, readable paths that won't go out of date, like `/x200`, `/catalogue` or `/warranty`.

A few practical points:

- **Ask IT for a subdomain, not the main domain.** It's one DNS record, and it doesn't change how the website or email work.
- **Create the codes in an account the company owns**, with at least two people who can sign in.
- **Keep a list of what's printed where**, so you know which codes to update when a page moves.

We wrote separately about [QR codes for instruction manuals](/blog/qr-code-for-instruction-manuals), where codes have to keep working for the life of the product, and about QR codes for trade shows. Both are on the [iShortn blog](/blog).

## How to set it up in iShortn

1. On Pro or Ultra, open **Domains** and add your subdomain, for example `qr.yourbrand.com`.
2. At your DNS provider, create the records the domain card shows: a CNAME to `cname.ishortn.ink` and, if asked, a TXT record. On Cloudflare, set the CNAME to **DNS only**. iShortn issues and renews the SSL certificate.
3. Wait for the domain to show **Active**. DNS changes usually show up within minutes, but can take up to 48 hours.
4. Create a QR code under **QR Codes** and pick your subdomain as the link domain. Add your logo and colours, then download a PNG, or an SVG for large print and engraving.

Styled codes get a short random path. If you want a readable path like `/menu`, create a short link with that alias on your domain and download its plain QR code from the link's menu. The [custom domain guide](/docs/custom-domains) covers DNS for each provider, apex domains and troubleshooting.

On the ownership points above:

- **If you cancel Pro**, links and codes already on your domain keep redirecting. You can't create new links on it until you upgrade again.
- **You can export your links** (alias, domain and destination) as CSV or JSON from the dashboard at any time.
- **iShortn is MIT-licensed.** If you ever want to run it yourself, the [self-hosting guide](/docs/self-hosting) explains how.

The free plan doesn't include custom domains. It does include 5 dynamic QR codes on an iShortn domain, so you can try the dashboard before upgrading. [Pro](/pricing) is $8 a month with 3 custom domains and unlimited QR codes. Ultra is $15 a month with unlimited domains and team workspaces.

## Quick answers

**Can I use my own domain for QR codes?** Yes, with a dynamic QR tool that supports custom domains. You point a subdomain you own at the tool with a DNS record, and your codes use that subdomain instead of the vendor's.

**Do QR codes on a custom domain scan better?** They scan the same. The difference is what people see before they open the link: your domain instead of a vendor's, and a printed code you can move to another service later.

**Can I move QR codes I've already printed to my own domain?** No. A printed code contains the domain it was made with. You can only change where that link redirects, and only while the old vendor keeps it running. New print runs can use your domain.

**Is there a free QR code generator with a custom domain?** None of the tools in the table above includes one on its free plan, iShortn included. On iShortn, custom domains start on Pro at $8 a month.

**What happens to custom domain QR codes if I cancel?** It depends on the tool, so check before you print. On iShortn, links already on your domain keep redirecting after you cancel Pro. Some tools switch them off until you resubscribe.

## Put your next codes on your own domain

If you're about to print something that will be around for a while, set up the subdomain first. It's one DNS record, and every code you print after that is on a domain you own.

**[Start free with iShortn →](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=qr-code-custom-domain)**

No card needed. Custom domains are on Pro, from $8 a month.
