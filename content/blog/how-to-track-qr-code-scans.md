---
title: "How to Track QR Code Scans (Free and in Google Analytics)"
seoTitle: "How to Track QR Code Scans for Free"
description: "Three ways to track QR code scans: built-in scan analytics, UTM parameters in Google Analytics 4, or both. Includes a UTM naming scheme for print campaigns."
date: "2026-11-20"
author: "Kelvin Amoaba"
tags: ["qr code", "qr code tracking", "utm parameters", "analytics", "guide"]
published: true
---

You put a QR code on a flyer, a menu, a poster or a product box. Did anyone scan it? Which placement worked best? Did the people who scanned it buy anything?

You can answer all three questions, mostly for free, but only if you set the code up the right way *before* you print it. This guide covers the three tracking methods, when to use each, a UTM naming scheme for print campaigns, and how to read the numbers without fooling yourself.

We make iShortn, a link shortener with free dynamic QR codes and scan analytics, so we'll show how it works there. The UTM and Google Analytics steps work with any tool.

## The three ways to track QR code scans

| Method | What it counts | Cost | Can you edit the code after printing? |
|---|---|---|---|
| **1. Dynamic QR code with scan analytics** | Every scan, plus country, device and time | Free on some plans | Yes |
| **2. UTM parameters + Google Analytics 4** | Visits to your website that came from the code | Free | No, if the code is static |
| **3. Both together** | Scans *and* what scanners did on your site | Free on some plans | Yes |

The short answer: **use method 3** if your code points at your own website, and method 1 if it points somewhere you can't install analytics (an Instagram profile, a Google review page, a PDF).

## Method 1: Use a dynamic QR code with built-in scan analytics

A dynamic QR code contains a short link instead of your final URL. When someone scans it, the short link service records the scan and immediately redirects them to your page. That's what makes tracking possible: the scan passes through a server that can count it.

Because the code contains the short link, you can also change the destination later without reprinting. (That flexibility comes with a catch: the code only works while the provider keeps redirecting it. If you've ever seen an "expired" QR code, that's why.)

**What you'll typically see:**

- **Total scans and unique scans.** Unique scans count each person once, roughly. Total scans include the same person scanning twice.
- **Scans over time**, so you can see whether a poster got attention the week it went up and then went quiet.
- **Location** (country and city), useful when the same design is printed for several branches or cities.
- **Device and browser**: mostly iPhone vs Android for QR codes.

**What you won't see:** who scanned it. Scan analytics are aggregate. You'll see "14 scans from Accra on Android", not names or contact details. If you need to know who, send scanners to a form or offer that asks for their email.

**How to set it up in iShortn:**

1. In your dashboard, go to **QR Codes** and create a new code.
2. Paste the destination URL. Scan tracking is set up automatically; you don't need to make a short link first.
3. Style it (colors, pixel and corner shapes) and download it.
4. Click the QR code card any time to see its scans.

On the [free plan](/pricing) you get 5 dynamic QR codes. They don't expire, have no ads and include scan analytics with a 7-day view. Scans count toward the free plan's 1,000 tracked events a month; above that, codes keep redirecting but new scans aren't recorded until the month resets. Pro ($8/month) keeps 1 year of detailed scan history and adds a world map view.

**Use this method when** the destination isn't your website: a Google Business review link, a WhatsApp chat, an app store page, a YouTube video or a PDF. You can't add Google Analytics to those pages, so the scan count is the only data you'll get.

## Method 2: Add UTM parameters and read them in Google Analytics 4

UTM parameters are tags you add to the end of a URL, like this:

```
https://yourshop.com/menu?utm_source=qr&utm_medium=print&utm_campaign=winter_menu&utm_content=table_tent
```

You can build the tagged URL with our [free UTM builder](/utm-builder). Its QR code preset fills in `qr` as the source and `print` as the medium.

When someone opens that URL, Google Analytics (and most other analytics tools, such as Plausible, Fathom, Matomo and PostHog) reads the tags and files the visit under that source and campaign. Without tags, QR visits usually show up as "Direct" traffic, mixed in with people who typed your address or used a bookmark.

**How to set it up:**

1. Build the tagged URL. You can use Google's free [Campaign URL Builder](https://ga-dev-tools.google/campaign-url-builder/) or type it by hand using the scheme below.
2. Open the tagged URL in your browser and check the page loads correctly.
3. Make a QR code from the tagged URL.
4. After people have scanned it, open GA4 and go to **Reports → Acquisition → Traffic acquisition**. Change the table's dimension to **Session source / medium** and look for `qr / print`. To compare individual placements, add **Session manual ad content** (that's your `utm_content` value) as a secondary dimension. New data can take a day or two to show up.

**The limitations:**

- **It counts visits, not scans.** If someone scans but the page never loads (bad signal, they canceled), or they decline your cookie banner, GA4 won't see them. Expect GA4 numbers to be lower than scan counts.
- **With a static code, the URL is fixed forever.** A typo in a tag, or a page you later move, means reprinting.
- **Long URLs make dense codes.** A static code that contains a long tagged URL has more modules and is harder to scan from print. Short links fix this.

## Method 3: Combine both (recommended)

Use a dynamic QR code, and make its destination the UTM-tagged URL. You get:

- **Scan counts** from the QR code service, including scans that never reached your page
- **On-site behavior and conversions** in Google Analytics, attributed to the right campaign and placement
- **A small, easy-to-scan code**, because it only contains a short link
- **The ability to fix mistakes**: edit the destination (tags included) after printing

In iShortn, you can do this on any plan by pasting the full tagged URL as the QR code's destination. On Ultra, the link editor also has dedicated UTM fields and saved UTM templates. On Pro, a campaign can stamp `utm_campaign`, `utm_source` and `utm_medium` onto every link you add to it automatically.

**Compare scans with visits.** If 200 people scanned a code and GA4 shows 150 sessions from it, that's normal (consent banners and abandoned loads). If it's 200 scans and 10 sessions, check that the destination page loads quickly on mobile, and that your tags survive any redirects on your website.

## A UTM naming scheme for QR codes

Consistency matters more than the exact words. GA4 treats `QR`, `qr` and `qr-code` as three different sources. Pick a scheme, write it down and stick to it. Here's one that works well for print:

| Parameter | What it describes | Examples |
|---|---|---|
| `utm_source` | Always the same for QR codes | `qr` |
| `utm_medium` | The kind of physical item | `print`, `packaging`, `signage`, `event` |
| `utm_campaign` | The promotion or season | `winter_menu`, `grand_opening`, `black_friday_2026` |
| `utm_content` | The specific placement or version | `table_tent`, `window_poster`, `flyer_a5`, `store_kumasi` |

Rules of thumb:

- **Lowercase only, underscores instead of spaces.** `Winter Menu` becomes `winter%20menu` in the URL and splits your reports.
- **One code per placement you want to compare.** If the window poster and the table tent share a code, you can't tell them apart later, whatever tool you use.
- **Don't put personal data in UTMs.** No names or email addresses; tags end up in analytics tools and server logs.
- **Keep a simple spreadsheet** of every code: placement, destination, tags, print date. Six months later you'll be glad you did.

## Putting it together: a worked example

Say you run a café with two locations and you're launching a winter menu. You want to know whether the table tents or the window posters drive more orders, and which location's customers engage most.

1. Create four dynamic QR codes: table tent and window poster for each location.
2. Point each one at your online menu with its own tags, for example `?utm_source=qr&utm_medium=print&utm_campaign=winter_menu&utm_content=table_tent_east`.
3. On iShortn, add all four to one campaign (the free plan includes one active campaign). The campaign page totals scans across the codes and ranks them side by side, so you can see the split without a spreadsheet. If you also share the menu on Instagram with a short link, add that link to the same campaign to compare print with social.
4. After two weeks, compare: scans per code in iShortn, then online orders by `utm_content` in GA4.
5. Move your budget toward what worked. Because the codes are dynamic, you can repoint the weaker ones at a different offer instead of throwing the print away.

## Common mistakes

- **Making a static code for something you'll want to measure later.** You can't add tracking to a static code after printing.
- **Testing on screen only.** Print a proof and scan it with an iPhone and an Android phone before ordering 1,000 copies.
- **Sending scanners to your homepage.** Send them to a page that matches what the print promised (the menu, the offer, the signup). It converts better, and the numbers mean more.
- **Reading one day of data.** Print campaigns build slowly. Give them at least a week or two before judging.
- **Forgetting the plan rules.** Make sure your dynamic codes keep working if you stop paying, and check whether the plan stops *counting* scans at a limit.

## Frequently asked questions

**Can I track a QR code for free?**
Yes. A static code with UTM parameters tracked in Google Analytics is completely free but only counts website visits. For actual scan counts, use a dynamic code. iShortn's free plan includes 5 dynamic codes with scan analytics.

**Can I see who scanned my QR code?**
No QR tool can identify individual people from a scan. You see aggregate data such as location, device and time. To get contact details, send scanners to a form.

**Does adding UTM parameters change the QR code?**
For a static code, yes: the longer URL makes a different, denser code. For a dynamic code, no: the code contains the short link, so you can add or change tags in the destination without reprinting.

**Why are my QR scans higher than my Google Analytics visits?**
Scans are counted before the page loads, while GA4 only counts visitors whose page loaded and who allowed analytics. Some gap is normal.

## Start tracking your next QR code

If your next flyer, menu or poster is about to go to print, take five minutes now to make its code dynamic and tag the destination. You can [create a free iShortn account](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=how-to-track-qr-code-scans) and have a tracked QR code ready in about a minute. For tracking your other links, see our [complete guide to link click tracking](/blog/how-to-track-link-clicks).

If you make codes for clients, see [QR codes and short links for agencies and print shops](/solutions/agencies).
