---
title: "How to Cancel Bitly Without Breaking Your Links and QR Codes"
seoTitle: "How to Cancel Bitly Without Breaking Your Links"
description: "Cancelling Bitly takes a minute. What happens to your links and printed QR codes afterwards depends on their domain. What to check, export and move first, in order."
date: "2026-11-29"
author: "Kelvin Amoaba"
tags: ["bitly", "cancel bitly", "migration", "custom domain", "qr code"]
published: true
---

The cancel button is the easy part. It sits in your billing settings and takes about a minute. The part that needs thought is what your existing links and printed QR codes do once the plan ends, and Bitly's answer depends on which domain each link uses.

This guide covers the steps to cancel, what happens to each kind of link, and what to export and move before you click anything. It's written for teams with links on brochures, packaging, manuals or sales decks, where a broken link can't be fixed by editing a post.

We make iShortn, a link shortener, so we'd like you to move to us. Everything about Bitly below comes from Bitly's own help center and pricing page, checked on 25 November 2026, with links so you can confirm it.

## The short version

- **Links on `bit.ly`** keep working after you cancel, and even after you delete the account.
- **Links on a domain you bought yourself**, such as `go.yourcompany.com`, keep redirecting while the domain's DNS points at Bitly. Bitly stops renewing the SSL certificate, though, so visitors can later see a "not secure" warning. You can move these links with the same addresses.
- **Links on the complimentary domain Bitly gave you** stop working when that domain's registration runs out, and Bitly doesn't let you transfer it.
- **There's no refund.** Your plan runs to the end of the period you've paid for, then drops to Free.
- **Export your links before the plan ends.** Bitly lists data export on Growth and higher, so after you drop to Free you can't download the list.

## How to cancel a Bitly subscription

These are the steps from Bitly's article [How do I change my Bitly subscription?](https://support.bitly.com/hc/en-us/articles/360027185191-How-do-I-change-my-Bitly-subscription):

1. Log in to Bitly and click **Settings** in the left sidebar.
2. Under **Account settings**, click **Billing and usage**.
3. In the plan details section, click **Downgrade to free**.
4. Follow the prompts to confirm.

You keep your paid features until the end of the current billing period. After that the account becomes a Free account. If you change your mind before then, go back to the same page and click **Cancel Downgrade**. On a custom Enterprise plan, Bitly asks you to go through your account manager instead.

Cancelling doesn't trigger a refund. Bitly's [refund article](https://support.bitly.com/hc/en-us/articles/360025217612-Can-I-get-a-refund-if-I-cancel-my-Bitly-account) says all fees are non-refundable, even if you cancel on the day you signed up. On an annual plan, that can mean months of paid time left, which is useful: it's your window to move links without rushing.

### Cancelling isn't deleting

Downgrading to Free keeps the account. Deleting it is a separate step under **Settings → Profile → Delete Account**, and Bitly asks you to downgrade first ([delete account article](https://support.bitly.com/hc/en-us/articles/360004560491-How-do-I-delete-my-Bitly-account)). Deletion can take up to 30 days and can't be undone. After that you can't edit links or see any click data.

Don't delete the account until every link you care about has moved and you've checked it. Until then, the Bitly account is your way back if something goes wrong.

## What happens to your links after you cancel

Bitly explains this in two articles: [what happens when you downgrade](https://support.bitly.com/hc/en-us/articles/360029870551-What-happens-when-I-downgrade-to-a-lower-subscription-plan) and [what happens after an account is deleted](https://support.bitly.com/hc/en-us/articles/360059651871-What-happens-to-my-personal-information-links-and-QR-Codes-after-my-account-is-deleted). In short:

| Where the link lives | After you downgrade to Free | After you delete the account | Can it move to another tool? |
|---|---|---|---|
| `bit.ly/...` | Keeps working | Keeps working | No. Bitly owns `bit.ly` |
| Your own domain, such as `go.yourcompany.com` | Keeps redirecting while DNS points at Bitly. The SSL certificate isn't renewed, so a "not secure" warning can appear later. No new links on the domain | Same | Yes, with the same addresses |
| Bitly's complimentary domain | Works until the domain's registration expires. Bitly shows the date on the downgrade confirmation screen | Works until the registration expires, one year after you got the domain or after its last renewal | No. Bitly says it [can't be transferred](https://support.bitly.com/hc/en-us/articles/360056355631-Can-I-buy-or-transfer-the-complimentary-custom-domain-from-Bitly) to you or anyone else |

QR codes follow the same rules. Bitly describes each QR code as "a scannable form of a short link", so a code behaves like the link it opens. Link-in-bio pages work the same way, depending on the domain they use.

A few things change even for links that keep working:

- **You can't change where links go.** Bitly's pricing page lists no redirects on Free. If a page behind a printed QR code moves after you cancel, the code keeps sending people to the old address.
- **You lose click data.** The Free plan on Bitly's [pricing page](https://bitly.com/pages/pricing) doesn't include click and scan data.
- **The ad page.** Bitly shows an ad page before redirecting links made on free accounts. Its help center doesn't say whether links you made while paying get that page after you drop to Free. Open one in a private window after your plan ends and check.

## Before you cancel: a checklist

Do these while you're still on the paid plan.

**1. Find out which domain your links use.** Open your Bitly links list and look at the domain column. For printed material, scan a few real QR codes and read the address your phone shows before it opens. People are often surprised to find that the codes on last year's catalogue are on `bit.ly` and the newer ones on a branded domain, or the other way round.

**2. Check whether your branded domain is yours or Bitly's.** If you bought it from a registrar (GoDaddy, Namecheap, Cloudflare and so on) and added it to Bitly, it's yours and it can move. If you picked it when you signed up for Growth and never paid a registrar for it, it's probably Bitly's complimentary domain, and it stays behind.

**3. Export your links.** In Bitly, open **Links**, click **Export**, choose an email address and download the CSV from the email Bitly sends ([export article](https://support.bitly.com/hc/en-us/articles/115000268051-How-to-export-all-the-data-in-a-range-from-the-All-Links-page)). Large exports can take up to 30 minutes. The file lists each link, its custom back-half, title, destination, creation date, total engagements and whether it was deleted. Selecting links and exporting them gives at most 100 rows, so use the full export.

**4. Save the reports you need.** The link export has one total per link, not click history. If you report monthly clicks to a manager or a client, download those reports from Bitly's analytics pages now. Click history doesn't move between tools.

**5. Move your own domain before the plan ends.** Point it at the new tool, import your links and test them, then let the Bitly plan lapse. Doing it in that order means you never depend on a certificate Bitly has stopped renewing.

**6. Make a plan for links on the complimentary domain.** These can't move, so they stop working when the registration expires. You have three options:

- Keep paying Bitly until the printed material with those links is out of circulation.
- Start putting new links on a domain you own today, and replace the old ones as you reprint.
- For links on web pages and emails you control, update them to new links before the domain expires.

Note the expiry date Bitly shows on the downgrade confirmation screen and put it in a calendar.

## How to move your own domain away from Bitly

The steps are the same whichever tool you move to:

1. Add the domain to the new tool. It shows you DNS records to create.
2. At your DNS provider, replace Bitly's records with the new ones. For a subdomain, that usually means changing a `CNAME` that points to `cname.bitly.com`.
3. Import Bitly's CSV so each back-half becomes the same path on the new tool.
4. Open a handful of old links in a private window and scan a printed code to check them.

Links on the domain stop redirecting between the DNS change and the import, usually for a few minutes. Do it at a quiet time.

`bit.ly` links can't keep their address anywhere else. They'll go on working as Bitly links, but new links will live on your new tool. For printed material with `bit.ly` codes, reprint on your own domain when you next update the artwork.

## Moving to iShortn

iShortn reads Bitly's export file as it is, without editing:

- **Same addresses on your domain.** Custom back-halves become aliases on your domain, so `go.yourcompany.com/spring-catalogue` keeps that exact address. Bitly's random codes on your domain, such as `go.yourcompany.com/3XCetqn`, can keep working too. That option is on by default.
- **`bit.ly` rows** get a new short link on our domain, and the import summary lists each new address.
- **Some things stay behind.** Tags don't move, because Bitly's export doesn't include them. Neither do click history or creation dates, so analytics start from the first click on iShortn.
- **Re-running is safe.** If a row fails because the domain wasn't connected yet, fix it and upload the same file again. Links that already came across are skipped.

The full walk-through, including apex domains and DNS providers without ALIAS records, is in [Move your links from Bitly](/docs/migrate-from-bitly).

On price: [Pro](/pricing) is $8 a month or $80 a year. It includes 3 custom domains, 1,000 new links a month, a one-time allowance of 5,000 imported links on your own domains, unlimited QR codes and a year of detailed click data. Bitly's Growth plan, the cheapest with a custom domain, is $29 a month billed yearly or $35 billed monthly. Our [Bitly comparison](/compare/bitly) has the feature-by-feature version.

And since you're reading this because you're leaving a tool, here's how leaving iShortn works:

- **If you cancel Pro**, links and QR codes already on your domain keep redirecting. You can't add new links on that domain until you upgrade again.
- **You can export your links** (alias, domain, destination) as CSV or JSON at any time, on any plan.
- **The code is open source.** The [self-hosting guide](/docs/self-hosting) explains how to run it yourself.

If you're still deciding where to go, [our list of Bitly alternatives](/blog/bitly-alternatives) compares six options on price and limits, and [Bitly's free plan limits](/blog/bitly-free-plan-limits) explains what you keep if you stay on Bitly Free. If shared-domain link takeovers are part of why you're leaving, [this piece on hijacked Bitly links](/blog/bitly-link-hijacking) explains why your own domain protects you.

## Questions

### Do Bitly links stop working if I cancel?

Links on `bit.ly` don't. Links on your own domain keep redirecting while the DNS points at Bitly, but the SSL certificate isn't renewed, so browsers may warn visitors later. Links on Bitly's complimentary domain stop when that domain's registration expires.

### Do Bitly QR codes expire when I cancel?

Bitly says its [QR codes never expire](https://support.bitly.com/hc/en-us/articles/12231200298125-Do-Bitly-Codes-ever-expire), but a code is only as good as the link inside it. Codes on `bit.ly` keep working. Codes on the complimentary domain stop when it expires. Codes on your own domain can move to another tool if you keep their paths.

### Can I get a refund from Bitly?

Bitly's help center says fees are non-refundable, including when you cancel on the day you subscribed. Your paid features stay on until the end of the billing period.

### Can I take my Bitly complimentary domain with me?

No. Bitly's help center says the complimentary domain can't be transferred to you or another owner. If you want a domain you can take anywhere, buy one from a registrar and use it for new links.

### Should I delete my Bitly account after moving?

Wait until you've checked the moved links and the old printed codes for a few weeks. Your `bit.ly` links keep working after deletion, but you lose the ability to edit them or see their clicks, and Bitly can't restore a deleted account.

## Start with the export

Even if you're not ready to cancel, download your links file today while your plan still includes export. It's the one thing you can't get back after the plan ends.

**[Create a free iShortn account →](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=cancel-bitly-subscription)**

The free plan needs no card. CSV import and custom domains start on Pro at $8 a month.
