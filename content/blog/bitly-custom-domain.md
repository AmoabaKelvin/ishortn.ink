---
title: "Bitly Custom Domain: What It Costs, Whether You Can Get One Free, and How to Set One Up"
seoTitle: "Bitly Custom Domain: Cost, Free Options and Setup"
description: "A branded domain on Bitly starts with the Growth plan at $29 a month. What the complimentary domain really is, which tools include a custom domain for less or free, and the DNS setup for a subdomain or root domain."
date: "2026-12-03"
author: "Kelvin Amoaba"
tags: ["bitly", "custom domain", "branded links", "dns", "guide"]
published: true
---

A custom domain swaps `bit.ly` in your short links for a name you own, so `bit.ly/3rsKP93` becomes `go.yourcompany.com/spring-sale`. On Bitly, that feature starts with the Growth plan, and the domain Bitly offers you with it comes with conditions most people only read about when they try to leave.

This post covers what a branded domain costs on Bitly and elsewhere, whether you can get one free, how to choose between a subdomain and a root domain, and how to set one up. We make iShortn, a link shortener with custom domains, so the setup walk-through uses it. Everything about Bitly below comes from Bitly's own pricing page and help center, checked on 26 November 2026, with links so you can check it yourself.

## The short version

- **Bitly's cheapest plan with a custom domain is Growth**: $29 a month billed yearly ($348 a year), or $35 billed monthly. The Free and Core plans don't include one ([Bitly pricing](https://bitly.com/pages/pricing)).
- **Growth and Premium include one custom domain.** Bitly's plan comparison lists "Multiple Custom Domains" only on Enterprise.
- **The "complimentary" domain isn't yours.** Bitly registers it for you. Bitly says it "cannot be transferred to you or another owner", and if you leave, links on it stop working when the registration runs out.
- **You can't get a custom domain free on Bitly.** Short.io, Dub and Rebrandly include one or more on their free plans. iShortn Pro is $8 a month with 3 custom domains.
- **Use a subdomain if you already have a website**, such as `go.yourcompany.com`. Neither Bitly nor iShortn can share the exact domain your website runs on.

## What a custom domain costs on Bitly

From Bitly's [pricing page](https://bitly.com/pages/pricing), in US dollars:

| Plan | Price | Custom domains | Destination changes ("redirects") | Click data kept |
|---|---|---|---|---|
| Free | $0 | None | None | None listed |
| Core | $10/month, billed yearly only | None | 5 a month | 30 days |
| Growth | $29/month billed yearly, $35 billed monthly | 1 (complimentary or your own) | 20 a month | 120 days |
| Premium | $199/month billed yearly, $300 billed monthly | 1 (complimentary or your own) | 110 a month | 1 year |
| Enterprise | Custom quote | Multiple | Custom | 2 years |

If you print QR codes, look at the redirects column. Bitly counts each change of a link's destination as a "redirect", and Growth allows 20 a month. If a catalogue, a menu or a product page moves and you have 40 printed codes pointing at it, updating them all takes two months on Growth.

The domain name itself is extra if you bring your own. Bitly's help center sends you to a registrar such as GoDaddy to [buy one](https://support.bitly.com/hc/en-us/articles/360058780372-How-do-I-buy-a-custom-domain). A subdomain of a domain you already own costs nothing extra, which is why we suggest one.

## The complimentary domain is free, but it isn't yours

When you subscribe to Growth or Premium, Bitly offers to register a domain for you instead of you buying one. Its help center says it [offers domains worth up to $30](https://support.bitly.com/hc/en-us/articles/360059959271-What-top-level-domains-can-I-redeem-as-my-complimentary-domain), across more than 250 endings such as `.co`, `.link` and `.company`.

It saves you a trip to a registrar. Before you pick one, know three rules from Bitly's own articles:

1. **You pick once.** You "only get to choose one domain through this offer and cannot choose a different one after your selection is made" ([source](https://support.bitly.com/hc/en-us/articles/360056355631-Can-I-buy-or-transfer-the-complimentary-custom-domain-from-Bitly)).
2. **You can't take it with you.** "The domain cannot be transferred to you or another owner" (same article). You can't point it at another link shortener later.
3. **It needs an active paid plan.** If you downgrade to a plan without a custom domain, Bitly [won't renew the registration](https://support.bitly.com/hc/en-us/articles/360059892432), and "when that registration expires, any links using that domain stop working". That happens up to a year after you received the domain or last renewed it ([source](https://support.bitly.com/hc/en-us/articles/360059482031-Will-my-links-still-work-if-I-change-my-custom-domain)).

A domain you buy yourself behaves differently. If you downgrade, Bitly says its links [keep working while the DNS points at Bitly](https://support.bitly.com/hc/en-us/articles/360029870551), but it stops renewing the SSL certificate, so visitors may later see a "not secure" warning. You can't create new links on it either. The difference is that you can point your own domain at a different tool and keep every address.

| | Complimentary domain from Bitly | Domain you bought yourself |
|---|---|---|
| Who owns it | Bitly registers it | You do |
| Cost | Included with Growth and Premium | Registrar fee, or nothing for a subdomain you already have |
| If you downgrade | Links stop when the registration expires | Links keep redirecting while DNS points at Bitly, but the SSL certificate isn't renewed |
| Can you move it to another tool | No | Yes, with the same link addresses |

For anything printed (packaging, brochures, signs, business cards), buy your own domain or use a subdomain. A printed code on a domain you can't move only works as long as you keep paying the same company.

## Can you get a custom domain for free?

Not on Bitly. The Free and Core plans have no custom domain, and the complimentary domain needs Growth.

Some other link shorteners include custom domains on their free plans. From each company's pricing page, checked 26 November 2026:

| Tool | Free plan | Cheapest paid plan with a custom domain |
|---|---|---|
| [Short.io](https://short.io/pricing) | 5 custom domains, 1,000 branded links in total | Free plan |
| [Dub](https://dub.co/pricing/links) | 3 custom domains, 25 new links a month | Free plan |
| [Rebrandly](https://www.rebrandly.com/pricing) | 1 custom domain, 10 new links a month | Free plan; Essentials ($11/month billed yearly) has 2 |
| [iShortn](/pricing) | No custom domain; 30 links a month | Pro, $8/month or $80/year, 3 custom domains |
| [Bitly](https://bitly.com/pages/pricing) | No custom domain; 5 links a month | Growth, $29/month billed yearly, 1 custom domain |

"Free" here means the link shortener costs nothing. You still need a domain, though a subdomain of your company domain costs nothing extra. If free is a hard requirement and your volume is small, Short.io's free plan is the most generous on domains. If you want a paid plan that costs less than Bitly Growth, with more domains, iShortn Pro is $8 a month. Our [list of Bitly alternatives](/blog/bitly-alternatives) compares six options on price and limits.

## Subdomain or root domain?

You have two choices for a short-link domain:

- **A subdomain** of the domain you already use, such as `go.yourcompany.com` or `links.yourcompany.com`. Your website stays where it is, every DNS provider supports it, and people already recognise the name. This is what we recommend for most companies.
- **A root (apex) domain** you keep only for short links, such as `yourco.link`. It's shorter, but it can't be the domain your website runs on, and you need to buy it.

Bitly and iShortn both refuse the exact domain your website uses, because one domain can't send visitors to two places at once. Bitly's help center [gives three options](https://support.bitly.com/hc/en-us/articles/4405629029261-Can-I-use-my-website-s-domain-as-my-custom-domain-in-my-Bitly-account) instead. Use a subdomain, buy a different domain, or take the complimentary one.

## DNS records: Bitly vs iShortn

The records differ slightly between the two tools. On Bitly ([source](https://support.bitly.com/hc/en-us/articles/230898888-How-do-I-configure-my-DNS-settings-for-my-custom-domain)):

| Setup | Record | Name | Value |
|---|---|---|---|
| Root domain | `A` | `@` | `67.199.248.12` |
| Root domain | `A` | `@` | `67.199.248.13` |
| Subdomain | `CNAME` | The subdomain, such as `go` | `cname.bitly.com` |

Bitly asks for both A records and says to remove any other A records on the root.

On iShortn ([custom domain docs](/docs/custom-domains)):

| Setup | Record | Name | Value |
|---|---|---|---|
| Subdomain | `CNAME` | The subdomain, such as `go` | `cname.ishortn.ink` |
| Root domain | `ALIAS`, `ANAME` or flattened `CNAME` | `@` | `cname.ishortn.ink` |
| Both, when shown | `TXT` | `_cf-custom-hostname` (or `_cf-custom-hostname.go` for a subdomain) | The value on your domain card |

A root domain on iShortn needs a DNS provider that supports ALIAS, ANAME or CNAME flattening at the root. Cloudflare, Namecheap, Porkbun and Route 53 do. GoDaddy doesn't, so the docs explain how to move the domain's DNS to Cloudflare's free plan while it stays registered at GoDaddy.

## How to set up a custom domain on iShortn

1. **Start Pro** from the [pricing page](/pricing). Custom domains are on Pro and Ultra.
2. **Add the domain.** Open **Domains** in the dashboard, click **Add Domain** and type it without `https://`, for example `go.yourcompany.com`. It shows as **Pending** with the records to create.
3. **Create the DNS records** at the company that runs your DNS, usually where you bought the domain. For a subdomain, enter only the part before your domain (`go`), because most providers add the rest themselves. If your DNS is on Cloudflare, set the record to **DNS only** (grey cloud) and SSL/TLS to **Full**.
4. **Wait for Active.** iShortn checks the records every 30 seconds while the Domains page is open, and you can click **Check Now**. It also issues the SSL certificate. DNS changes usually show up within minutes and can take up to 48 hours.
5. **Make it your default** so new links use it, then create a link with a readable alias, such as `go.yourcompany.com/catalogue`. Every short link also has a QR code you can download as PNG or SVG.

The full steps, with troubleshooting for the usual mistakes, are in the [custom domain docs](/docs/custom-domains). Before you start, know that deleting a domain in iShortn also deletes the links on it. Move any you want to keep to another domain first.

## What happens to your links if you cancel

This is the question to ask any tool before you print a code.

On Bitly, links on `bit.ly` keep working. Links on your own domain keep redirecting while the DNS points at Bitly, without SSL renewal. Links on the complimentary domain stop when its registration expires. Our guide to [cancelling Bitly without breaking your links](/blog/cancel-bitly-subscription) goes through the order to do things in.

On iShortn:

- **If you cancel Pro**, links and QR codes already on your domain keep redirecting, and nothing is deleted. You can't create new links on that domain until you upgrade again.
- **You can export your links** (alias, domain, destination) as CSV or JSON at any time, on any plan.
- **The domain stays yours.** You bought it, so you can point it at another service and recreate the same paths.
- **The code is open source**, and the [self-hosting guide](/docs/self-hosting) explains how to run it yourself.

## Already have your domain on Bitly?

If you bought your branded domain yourself, you can move it with the same link addresses. Export your links from Bitly, add the domain to iShortn, change the DNS record, and import Bitly's export file without editing it. Custom back-halves keep their exact addresses, and Bitly's random codes on your domain can be kept too. Pro includes a one-time allowance of 5,000 imported links on your own domains. [Move your links from Bitly](/docs/migrate-from-bitly) has the steps.

Links on Bitly's complimentary domain can't move, because the domain can't be transferred. Put new links on a domain you own now, and replace the old ones as you reprint.

## When Bitly is still the better choice

- **You want the domain bought for you.** Bitly's complimentary domain saves you from dealing with a registrar. Choose it knowing it stays with Bitly.
- **You need Bitly's extras.** Premium adds mobile deep linking and city-level data, and Bitly has landing pages and a large integrations library.
- **Your company already runs on Bitly Enterprise**, with SSO and many domains across teams.

For a feature-by-feature view, see [iShortn vs Bitly](/compare/bitly).

## Frequently asked questions

### How much does a custom domain cost on Bitly?

The cheapest Bitly plan with a custom domain is Growth, at $29 a month billed yearly or $35 billed monthly. It includes one custom domain. More than one needs Enterprise, which is priced by quote.

### Is the Bitly complimentary domain free?

It's included with Growth and Premium at no extra charge, but Bitly keeps it. It can't be transferred to you, and links on it stop working when the registration expires after you downgrade.

### Can I use my website's domain as my Bitly custom domain?

No. Bitly needs a domain that isn't serving your website. Use a subdomain such as `go.yourcompany.com`, or buy a separate short domain.

### Can I get a custom short link domain for free?

Not on Bitly. Short.io (5 domains), Dub (3) and Rebrandly (1) include custom domains on their free plans. iShortn's custom domains start on Pro at $8 a month.

### Do I need an A record or a CNAME?

On Bitly, a root domain uses two A records and a subdomain uses a CNAME to `cname.bitly.com`. On iShortn, a subdomain uses a CNAME to `cname.ishortn.ink`, and a root domain uses an ALIAS, ANAME or flattened CNAME to the same value.

### What happens to my branded links if I stop paying?

On Bitly, links on your own domain keep redirecting but lose SSL renewal, and links on the complimentary domain stop when it expires. On iShortn, links already on your domain keep redirecting, and you can't add new ones until you upgrade.

## Put your links on your own domain

Pick a subdomain such as `go.yourcompany.com`, connect it in a few minutes, and every link and QR code you create after that carries your name.

**[Create a free iShortn account →](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=bitly-custom-domain)**

The free plan needs no card. Custom domains start on Pro at $8 a month, with 3 domains included.
