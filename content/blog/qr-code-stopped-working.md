---
title: "QR Code Stopped Working or Expired? How to Fix It"
description: "Why printed QR codes suddenly show an 'expired' page or stop scanning, how to tell which problem you have, and how to make QR codes that don't expire."
date: "2026-11-20"
author: "Kelvin Amoaba"
tags: ["qr code", "dynamic qr code", "troubleshooting", "guide"]
published: true
---

You printed 500 flyers, a menu, or a shop window sticker. It scanned fine for weeks. Now customers are telling you the QR code goes to a page that says "This QR code has expired, please renew your plan", or to nothing at all.

The good news is that a QR code almost never wears out. The black-and-white pattern on your print is still fine. Something behind it changed, and in most cases you can fix it without reprinting. This guide covers the five usual causes, how to work out which one you have, and how to avoid the problem with your next code.

We make iShortn, a link shortener with free dynamic QR codes, so we've seen this problem a lot from people moving over to us. We'll explain how we handle it, but the troubleshooting steps work whichever tool you use.

## First, find out what kind of QR code you have

There are two kinds of QR code, and they fail for different reasons.

**A static QR code** stores your destination URL directly in the pattern. Scan it and your phone opens `https://yourshop.com/menu` straight away. Nothing sits in between, so nothing can expire. The only thing that can break it is the destination itself.

**A dynamic QR code** stores a short link that belongs to the QR code provider, something like `https://provider.com/abc123`. When someone scans it, the provider's server redirects them to your real page. That's what lets you change the destination after printing and count scans, but it also means the code only works while the provider keeps redirecting it.

**How to tell which one you have:** scan the code with your phone camera and look at the URL preview before you tap it.

- If the preview shows your own website address in full, it's static.
- If it shows a short link on someone else's domain, it's dynamic, and that domain is the company whose plan controls it.

## Cause 1: Your free trial or paid plan ended (the most common one)

If scanning shows an "expired", "deactivated" or "renew your plan" page, this is almost certainly it.

Many QR code generators let you create dynamic codes during a free trial or on a subscription, and switch those codes off when the trial ends or the subscription lapses. This is in their own documentation. The QR Code Generator (TQRCG), for example, says in its [help center](https://docs.the-qrcode-generator.com/en/articles/13009388-what-happens-to-qr-codes-when-my-subscription-or-trial-expires-and-can-i-reactivate-them) that "if your subscription expires, all dynamic QR codes linked to your account will become inactive", and that after a trial "up to two dynamic QR codes might remain active with ads, while the rest become inactive." QR Code Generator PRO's [tracking guide](https://www.qr-code-generator.com/blog/qr-code-tracking/) describes its dynamic codes as working "while your plan is active."

It's a business model, not a scam, but it's easy to miss when you sign up to make one code for a flyer.

**How to fix it:**

1. **Fastest:** log in to the account that made the code and reactivate the plan. Because the short link inside the code hasn't changed, your printed codes start working again without reprinting. Both providers above say so.
2. **If you don't want to pay:** you'll need a new code and new prints. A new code with the same content won't revive the old one, because the old short link still belongs to the old provider.
3. **If you can't reach the account** (an agency or ex-employee made it): contact the provider's support with the QR code's ID or short link. Next time, make sure the account belongs to the business.

## Cause 2: The destination page moved or was deleted

This is the most common way for a static code to "stop working". Someone redesigns the website, the menu moves from `/menu` to `/food`, a Google Drive file gets deleted, or a PDF is replaced under a new link. The QR code still scans perfectly, and it opens a 404 page.

**How to fix it:**

- **Static code:** put a redirect on your website from the old address to the new one (your website platform or developer can add a 301 redirect), or restore the page. The code itself can't be changed.
- **Dynamic code:** open your QR code dashboard and change the destination to the new page. It takes seconds and every printed copy follows.

Shared-drive files are a common trap: check the sharing setting ("Anyone with the link"), and remember that uploading a new version as a new file gives it a new link.

## Cause 3: The domain behind the code expired

If the code points to your own domain, or to a branded short domain you set up, and that domain's registration lapses, every code that uses it stops working. Worse, once someone else registers an expired domain, your printed codes send customers to them.

**How to fix it:** renew the domain with your registrar straight away, and turn on auto-renew. If the domain has already been taken by someone else, stop using those prints.

## Cause 4: The code doesn't scan at all

If the phone camera doesn't react at all (no link preview appears), the problem is physical, not the link. Common reasons:

- **Too small.** A practical minimum is about 2 × 2 cm (0.8 in) for something held in the hand, and much bigger for posters read from a distance. A common rule of thumb is a code width of about a tenth of the scanning distance.
- **Low contrast or inverted colors.** Dark code on a light background is the safest choice. Light-on-dark and pale brand colors fail on some phones.
- **No quiet zone.** The code needs a clear margin around it. Cropping it tight against a border or photo can break it.
- **A logo or effect covering too much.** Codes tolerate some damage, but a big logo, glossy laminate glare or a heavy design effect can push them past it.
- **Too much data.** A very long URL in a static code makes a dense pattern that's hard to scan from print. A short link gives you a simpler code.

**How to fix it:** test the printed piece, not the file on your screen, with an iPhone and an Android phone, in the light it will actually be seen in. If it's marginal, regenerate it larger with plain colors and a clear margin.

## Cause 5: The provider blocked or removed the link

Short link services scan for phishing and malware. If a destination gets flagged, or the provider shuts down entirely, the redirect stops. For a legitimate link, contact the provider's support. If the provider has shut down, the only fix is new codes, which is the best argument for using your own domain (see below).

## A quick diagnosis checklist

| What you see when you scan | Most likely cause | Can you fix it without reprinting? |
|---|---|---|
| "Expired", "deactivated" or "renew your plan" page | Trial or subscription ended (Cause 1) | Yes, by reactivating the plan |
| Your website's 404 / "page not found" | Destination moved (Cause 2) | Yes: redirect it (static) or edit it (dynamic) |
| A parked page, ads or a stranger's site | Domain expired (Cause 3) | Only if you can renew the domain in time |
| Camera doesn't react at all | Print quality, size or contrast (Cause 4) | No, the code needs reprinting |
| A warning or "link disabled" page | Flagged or removed by the provider (Cause 5) | Sometimes, through the provider's support |

## How to make QR codes that don't expire

You want a code that never stops working and that you can still change after printing. Here's how to get both.

### Know the rules before you print

Before you create a dynamic code anywhere, find answers to three questions on the provider's pricing page:

1. **Do dynamic codes keep working if I stop paying or never start?**
2. **Is there a scan limit?** Some plans cap scans or stop counting them.
3. **Can I change the destination on this plan?** Bitly's free plan, for example, includes 2 QR codes a month and unlimited scans, but its [pricing page](https://bitly.com/pages/pricing) lists "Change the destination page for links and QR Codes" as unavailable on Free.

If the answer to the first one isn't clearly "yes", treat the code as rented.

### Use a static code when the destination will truly never change

A static code pointing at your own homepage is permanent for as long as you own the domain. It's a fine choice for a business card. The trade-off: you can't edit it and you can't count scans.

### Use a dynamic code from a plan that doesn't switch it off

This is what we built iShortn's QR codes to do. On the [free plan](/pricing):

- You get **5 dynamic QR codes**. You can change where each one points at any time, they don't expire, and there are no ads in front of your page.
- They keep redirecting when you don't upgrade. If you go over the free plan's 1,000 tracked events a month, scans still redirect; we just stop recording new ones until the month resets.
- Every code has **scan analytics**: total and unique scans, country and city, device and browser. Free shows the last 7 days of data, and Pro and Ultra keep 1 year of detailed scan history. See our guide to [tracking link clicks](/blog/how-to-track-link-clicks) for adding UTM tags so scans also show up in Google Analytics.
- You can **pause** a code (deactivate it) and switch it back on later, and you can optionally set a code to switch itself off after a date or a number of scans. That only happens if you set it.

If you cancel a paid plan, the codes you've already made keep working.

Each QR code uses one of your monthly short links (30 a month on Free). If you need more than 5 codes, a custom domain or branded codes, [Pro is $8 a month](/pricing) and includes 3 custom domains.

### Put your own domain inside the code

The safest setup of all is a dynamic code that uses a short domain you own, like `go.yourshop.com`. If you ever change providers, the domain goes with you and you can point it at the new service. On iShortn, custom domains come with Pro. Our guide to [custom short links for your brand](/blog/custom-short-links-for-your-brand) walks through the DNS setup.

## Moving an existing code to a new provider

If you're stuck with a code from a provider you're leaving, here's the order that avoids downtime:

1. Create the replacement dynamic code with the new provider and point it at the same destination.
2. Test it on printed proofs.
3. Swap it into your design files and reprint as your stock runs out.
4. Keep the old plan running until the old prints are out of circulation, if the cost makes sense. If it doesn't, put a short "we've moved" note somewhere people will see it, like a table sign or an Instagram story.

## Frequently asked questions

**Do QR codes expire?**
The pattern itself never expires. Static codes work for as long as the destination exists. Dynamic codes work for as long as the provider keeps redirecting them, which depends on its plan rules.

**Can I change where a QR code goes after printing?**
Only if it's dynamic. Edit the destination in the provider's dashboard and every printed copy follows. With a static code you'd need a redirect on the destination website instead.

**Is there a free QR code generator that doesn't expire?**
Yes, several. Check the provider's own pricing page for whether its free dynamic codes stay active without a paid plan. iShortn's free plan includes 5 dynamic codes that don't expire and have no ads; we've listed exactly what's included above.

## The short version

When a QR code stops working, scan it and read the link. If you see your own URL, fix the page it points to. If you see a provider's short link and an "expired" page, the plan behind it lapsed. Next time, pick a dynamic code that's free to keep, or one on your own domain.

If you'd like to try it, [create a free iShortn account](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=qr-code-stopped-working) and make your first dynamic QR code. It takes about a minute, and you can change where it points whenever you need to. For more ideas on where to use QR codes, see our [guide to QR codes for business](/blog/free-qr-code-generator-guide).
