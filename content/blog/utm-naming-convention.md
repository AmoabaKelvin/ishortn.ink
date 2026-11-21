---
title: "UTM Naming Convention: A Simple Template for Small Teams"
seoTitle: "UTM Naming Convention Template for Small Teams"
description: "A UTM naming convention your whole team can follow: rules, allowed values for source and medium, campaign name formats, a copyable spreadsheet template and real examples."
date: "2026-12-04"
author: "Kelvin Amoaba"
tags: ["utm parameters", "utm naming convention", "google analytics", "campaign tracking", "guide"]
published: true
---

Open the Traffic acquisition report in Google Analytics 4 for any small business that has used UTM tags for a year, and you'll often find something like this. `facebook`, `Facebook`, `fb` and `facebook.com` as four separate sources. A medium called `social` and another called `Social Media`. A campaign called `newsletter` that ran for 14 months. Each tag made sense to the person who typed it. Together they make the report useless.

A naming convention fixes that. It's a short list of rules and allowed values that everyone on the team uses, so the same thing always gets the same name.

This guide gives you one you can copy: the rules, the values to use for source and medium, a format for campaign names, a spreadsheet template and worked examples. It's written for teams of one to ten people who don't have an analytics specialist. We make iShortn, a link shortener with a free [UTM builder](/utm-builder), and we'll point out where a tool helps and where a spreadsheet is enough.

## The short version

1. Lowercase everything. GA4 treats `Facebook` and `facebook` as different values.
2. Use underscores instead of spaces, and no special characters.
3. `utm_source` is the specific site or sender. `utm_medium` is the type of channel. Pick from a fixed list for both.
4. Campaign names follow one format, such as `black_friday_2026`.
5. Write every tagged link in one shared sheet before it goes out.

## What each UTM parameter is for

Google Analytics 4 reads these from your links. Google's [URL builders help page](https://support.google.com/analytics/answer/10917952) lists a few more, but these are the ones a small team will use:

| Parameter | Answers | Examples |
|---|---|---|
| `utm_source` | Which site, app or sender sent the visit? | `instagram`, `newsletter`, `google`, `partner_acme` |
| `utm_medium` | What type of channel was it? | `social`, `email`, `cpc`, `print`, `referral` |
| `utm_campaign` | Which promotion or push was it part of? | `black_friday_2026`, `spring_menu_2026` |
| `utm_content` | Which link, version or placement was clicked? | `bio_link`, `header_button`, `video_a` |
| `utm_term` | Which paid search keyword? | `qr_code_generator` |
| `utm_id` | Which campaign ID from your ad platform or cost data? | `fb_120203456` |

Google says you should always set source, medium and campaign. Leave one out and that field shows as `(not set)` in your reports. Content is worth using whenever you have two links in the same place and want to know which one people clicked. Term and ID mostly matter for paid ads, and many small teams never need them.

## The rules

### 1. Lowercase only

Google's help page puts it plainly: "Parameter values are case sensitive, e.g. utm_source=google is different from utm_source=Google." `Email` and `email` become two rows in your source and medium reports, and data already collected stays split. Lowercase is the easiest rule to follow and the one that saves the most cleanup.

### 2. Underscores, not spaces

A space in a URL becomes `%20` or `+`, and different tools handle that differently. Pick one separator and use it everywhere. This guide uses underscores, and our UTM builder converts spaces to underscores for you. Hyphens work just as well, as long as everyone uses the same one. If you use iShortn campaigns on Pro, note that the campaign name becomes `utm_campaign` with hyphens (`black-friday-2026`), so either use hyphens in campaign names everywhere or tag those links by hand.

### 3. Source is the "who", medium is the "how"

The most common mix-up is putting the channel type in the source or the site in the medium. Keep them apart:

- `utm_source=instagram&utm_medium=social`, not `utm_source=social&utm_medium=instagram`
- `utm_source=newsletter&utm_medium=email`, not `utm_source=email&utm_medium=newsletter`

The test: if you can say "we got visits from X by way of Y", X is the source and Y is the medium.

### 4. Use the medium names Google Analytics expects

GA4 sorts traffic into default channels like Email, Organic Social and Paid Social by reading your source and medium. The rules are on Google's [default channel group page](https://support.google.com/analytics/answer/9756891). If your medium matches one, the visit lands in the right channel. If nothing matches, GA4 files it under "Unassigned".

The medium values that map to each channel:

| Use this medium | GA4 channel | Notes |
|---|---|---|
| `email` | Email | Also matches if the source is `email` |
| `social` | Organic Social | `social-media`, `social-network` and `sm` also work |
| `paid_social` | Paid Social | Only when the source is a social site GA4 recognises, like `facebook` or `instagram` |
| `cpc` | Paid Search | Only when the source is a search engine, like `google` or `bing` |
| `display` or `banner` | Display | For banner ads |
| `affiliate` | Affiliates | Exactly `affiliate` |
| `referral` | Referral | `link` and `app` also work |
| `audio` | Audio | Podcast ads and mentions |
| `sms` | SMS | Text messages |

GA4 has no channel for print. Links tagged `utm_medium=print` (QR codes on flyers, packaging, posters) show as Unassigned in the channel report. That's fine, because they still appear by name in the source and medium report, which is the one you'll read for print anyway.

### 5. Campaign names follow one format

Choose a format and don't drift from it. A good one for small teams is `what_when`:

- `black_friday_2026`
- `spring_menu_2026`
- `webinar_2026_03`
- `always_on` for links that never change, like your Instagram bio or email signature

Avoid names that don't say what the campaign was (`promo`, `test`, `new`). In a year you won't remember.

### 6. Content describes the link, not the person

Use `utm_content` for the placement or version: `bio_link`, `story_swipe`, `footer_link`, `flyer_library`, `ad_video_a`. Never put names, email addresses or customer IDs in any UTM value. Tags end up in analytics tools, server logs and browser history, and personal data doesn't belong there.

### 7. Don't tag links between pages of your own site

UTM tags are for links that bring people to your site from somewhere else. If you tag a banner on your own homepage, the tag overrides where the visitor really came from, and your banner can take credit for sign-ups or sales that your newsletter or ad earned. Use UTMs on links that point to your site from outside it.

## Allowed values: a starter list

Copy this into the first tab of your sheet and add to it as you go. When someone needs a value that isn't on the list, they add it here first, so the next person reuses it.

| Channel | utm_source | utm_medium |
|---|---|---|
| Your email newsletter | `newsletter` | `email` |
| Transactional or one-off email | `email_signature`, `welcome_email` | `email` |
| Instagram (organic) | `instagram` | `social` |
| Facebook (organic) | `facebook` | `social` |
| LinkedIn (organic) | `linkedin` | `social` |
| TikTok (organic) | `tiktok` | `social` |
| X (organic) | `x` | `social` |
| Facebook or Instagram ads | `facebook` or `instagram` | `paid_social` |
| Google Ads | `google` | `cpc` |
| Partner site that links to you | the partner's name, like `acme_blog` | `referral` |
| Affiliate | the affiliate's name | `affiliate` |
| Text message | `sms` | `sms` |
| QR code on print | `qr` | `print` |
| Podcast mention or ad | the podcast's name | `audio` |

## The spreadsheet template

You don't need software for this. A shared Google Sheet with two tabs does the job.

**Tab 1: Allowed values.** The table above.

**Tab 2: Link log.** One row per tagged link, with these columns:

| Date | Owner | Destination URL | utm_source | utm_medium | utm_campaign | utm_content | Tagged URL | Short link | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 2026-12-01 | Ama | `https://yourshop.com/sale` | newsletter | email | black_friday_2026 | header_button | `https://yourshop.com/sale?utm_source=newsletter&...` | yourbrand.link/bf | Sent to full list |

To build the tagged URL in the sheet, a formula like this works (assuming the destination is in column C and the tags are in D to G):

```
=C2&"?utm_source="&D2&"&utm_medium="&E2&"&utm_campaign="&F2&IF(G2="","","&utm_content="&G2)
```

That formula assumes the destination has no `?` in it already. If it might, build the link in a UTM builder instead and paste the result into the sheet.

To stop people typing their own values, add a dropdown to the source and medium columns: in Google Sheets, select the column, open **Data > Data validation**, add a rule, choose **Dropdown (from a range)** and point it at the Allowed values tab.

## Worked examples

**A Black Friday email to your list, with two buttons:**

```
https://yourshop.com/sale?utm_source=newsletter&utm_medium=email&utm_campaign=black_friday_2026&utm_content=header_button
https://yourshop.com/sale?utm_source=newsletter&utm_medium=email&utm_campaign=black_friday_2026&utm_content=footer_link
```

**Your Instagram bio link, which never changes:**

```
https://yourshop.com/?utm_source=instagram&utm_medium=social&utm_campaign=always_on&utm_content=bio_link
```

**A flyer at the library with a QR code:**

```
https://yourshop.com/market?utm_source=qr&utm_medium=print&utm_campaign=spring_market_2026&utm_content=flyer_library
```

For more on tagging print, see [how to track QR code scans](/blog/how-to-track-qr-code-scans) and our guide to [QR codes on flyers](/blog/qr-code-for-flyers).

## How to make the convention stick

A convention only works if following it is easier than ignoring it.

- **One owner.** One person maintains the allowed-values list and approves new values. On a small team that takes a few minutes a month.
- **Build links in a tool, not by hand.** Our free [UTM builder](/utm-builder) lowercases values and swaps spaces for underscores automatically, has presets for common channels (newsletter, Instagram, Facebook, LinkedIn, X, TikTok, Google Ads, QR code), and can tag up to 1,000 URLs at once and export them as a CSV for your sheet. Google's [Campaign URL Builder](https://ga-dev-tools.google/campaign-url-builder/) also works.
- **Shorten the tagged link.** A URL with five tags is long and hard to read in a post or a text message. A short link hides the tags and is easier to type. It also gives you a second count of clicks to compare with GA4. Our guide to [short links for social media](/blog/short-links-social-media-marketing) has more on this.
- **Fix mistakes at the short link.** Once a tagged link is printed or posted, the tags are fixed. If it's behind a short link, you can edit the destination, tags included, and every click after that gets the right values. You can't rewrite the data GA4 already collected, but you can stop the mess growing.

In iShortn you can paste a tagged URL as the destination of any link or QR code on the free plan. On [Pro](/pricing) ($8 a month), a campaign can fill in `utm_source` and `utm_medium` for every link you add to it, and sets `utm_campaign` to the campaign's name. Ultra ($15 a month) adds UTM fields and saved UTM templates in the link editor, so the team picks from presets instead of typing.

## Check that it's working

After your first tagged links go out:

1. Click one yourself, then open GA4 and go to **Reports > Realtime**. Your visit should appear within a few minutes.
2. A day or two later, go to **Reports > Acquisition > Traffic acquisition**, change the main dimension to **Session source / medium**, and look for your values.
3. Look at the **Session default channel group** dimension too. If your tagged traffic shows as "Unassigned", the medium doesn't match one of GA4's channel rules. For print that's expected. For anything else, change the medium on the next links.

## Common mistakes

- **Tagging links on your own site.** Your own banner ends up with credit that belongs to the channel that brought the visitor.
- **Reusing a campaign name for years.** `newsletter` as a campaign tells you nothing. Use `always_on` for permanent links and a dated name for everything else.
- **Different people, different spellings.** Fixed with the allowed-values list and dropdowns.
- **Forgetting that tags are public.** Anyone can see them in the address bar. Don't write anything in a tag you wouldn't want a customer to read.
- **Testing on desktop only.** Open the tagged link from inside the app you're posting to, on a phone, and check it lands on the right page with the tags intact.

## Quick answers

**Are UTM parameters case sensitive?** Yes. Google's help page says parameter values are case sensitive, so `Facebook` and `facebook` show as two sources. Lowercase everything.

**What should utm_medium be for social media?** `social` for organic posts. For paid social ads, use `paid_social` with the platform as the source, so GA4 files them under Paid Social.

**What's the difference between utm_source and utm_medium?** Source is the specific site or sender (`instagram`, `newsletter`). Medium is the type of channel (`social`, `email`).

**Do I need a tool to manage UTM codes?** No. A shared spreadsheet with an allowed-values list is enough for a small team. A builder with lowercase cleanup, like our free [UTM builder](/utm-builder), saves typing and catches mistakes.

**Should I use hyphens or underscores?** Either. Pick one and use it everywhere.

## Start tagging

Copy the allowed-values table into a sheet, share it with whoever posts links for your business, and build the next batch of links in the [UTM builder](/utm-builder). When you want short, editable links on top, you can [create a free iShortn account](https://ishortn.ink/auth/sign-up?utm_source=ishortn_blog&utm_medium=blog&utm_campaign=utm-naming-convention) and paste your tagged URLs in.
