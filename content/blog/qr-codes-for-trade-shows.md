---
title: "QR Codes for Trade Shows: One Code per Placement, and How to Tell What Worked"
seoTitle: "QR Codes for Trade Shows: Setup and Tracking"
description: "How to use QR codes at a trade show booth: what each code should open, one code per banner, brochure and badge, sizes, UTM tags, and how to work out after the show which placements brought leads."
date: "2026-12-16"
author: "Kelvin Amoaba"
tags: ["qr code", "trade show", "events", "b2b", "tracking", "guide"]
published: true
---

A trade show booth costs real money: the space, the graphics, the travel, two or three days of your sales team. Then the show ends and someone asks which part of it worked. Was it the back wall, the brochures, the product samples or the conversations? Most teams can't say.

QR codes can answer part of that, if you set them up before the show rather than adding one to the banner at the last minute. This guide covers what each code should open, where to put them, how big to print them, how to tag them, and how to read the numbers afterwards.

We make iShortn, a link shortener with dynamic QR codes and scan analytics. The method works with any QR tool that counts scans per code.

## The short version

1. Give every placement its own code: back wall, counter, brochure, sample tags, staff badges.
2. Point them at a page made for the show, with a short form and one clear next step.
3. Tag each code's destination with UTM parameters, so your analytics and CRM can tell the placements apart.
4. Test every code on the real print, in bad light, from where visitors will stand.
5. After the show, point the codes at a follow-up page, and keep the graphics for the next show.

## Scans are not leads

A QR code counts scans. It doesn't know who scanned. If you want names and companies, the page behind the code has to ask for them, or your staff have to collect them.

Many shows offer exhibitors a lead retrieval app or badge scanner, usually for a fee. Your staff scan a visitor's badge and get their contact details. That's the best record of the people you spoke to, and a QR code doesn't replace it. What a QR code adds is the visitor who doesn't want a conversation yet: someone who reads the banner from the aisle, picks up a brochure or photographs a spec sheet and moves on. The code lets that person request a quote or a demo in their own time.

So plan both: badge scans for conversations, QR codes for everyone who walks past or takes something away.

## Decide what each code is for

Every code should do one job. The common ones at a B2B show:

- **Request a quote or a demo.** A short form with name, company, email and one question. This is the code that produces leads.
- **Get the spec sheet or catalogue.** A page with the PDF and a "send me the price list" form underneath.
- **Watch the product working.** A short video for machines you couldn't bring.
- **Book a meeting.** A calendar link for your sales team during the show.

Don't send any of them to your homepage. A visitor standing in an aisle won't go looking for the right page.

Keep the landing pages light. Phone signal in exhibition halls is often weak, and the show Wi-Fi is busy. A page that needs ten seconds to load loses most of the people who scanned it.

## One code per placement

Every code points at the same show page (or at one of a few pages), but each one counts its own scans. That's what lets you compare placements afterwards.

| Placement | What it usually opens | Minimum width |
|---|---|---|
| Back wall or hanging banner (read from the aisle, 2 to 3 m) | Quote or demo request | 20 to 30 cm |
| Counter, table tent or product stand (about 1 m) | Spec sheet or video | 10 cm |
| Sample tags and product cards (arm's length) | Spec sheet for that product | 2.5 to 3 cm |
| Brochure or catalogue | Price list or quote request | 2.5 cm |
| Staff badges or business cards | That person's calendar or contact page | 2.5 cm |

The widths follow the Nielsen Norman Group's [QR code guidelines](https://www.nngroup.com/articles/qr-code-guidelines/): at least 2 x 2 cm, plus about 1 cm for every 10 cm of scanning distance. Leave an empty margin around each code; [Denso Wave](https://www.qrcode.com/en/howto/code.html), which invented the QR code, specifies four modules. Put banner codes at eye height, not below the table edge where a visitor's legs block them. Matte material scans better than glossy vinyl under hall lighting.

Next to every code, write what scanning does: "Scan for the X200 price list", not "Scan me". And print a short typed address underneath for people who won't scan.

## Name and tag the codes

Name each code so you'll understand it in three months, for example `Spring Expo 2027 - back wall`. Then add UTM tags to each destination so Google Analytics, and any form tool that reads them, records which placement sent the visit:

```
https://yourcompany.com/expo?utm_source=qr&utm_medium=print&utm_campaign=spring_expo_2027&utm_content=back_wall
```

Keep `utm_source`, `utm_medium` and `utm_campaign` the same on every code at the show, and change only `utm_content` per placement. Our free [UTM builder](/utm-builder) has a QR code preset that fills in the source and medium, and [our UTM naming guide](/blog/utm-naming-convention) explains how to keep the names consistent from show to show.

If your form tool can save UTM values in hidden fields, as HubSpot forms and many other form builders can, every lead arrives in the CRM already marked with the placement that brought it. That's how you get from "the back wall had 140 scans" to "the back wall brought 9 quote requests and one order".

## Test before you ship the graphics

Print one copy of each code on the actual material, or get a proof from the print shop. Then:

1. Scan it with an iPhone and an Android phone from the distance in the table above.
2. Try it under bright light and at an angle, the way a visitor in the aisle would see it.
3. Load the page on mobile data, not office Wi-Fi.
4. Fill in the form once and check the lead arrives with its UTM values.

Do your tests a few days before the show, so your own scans fall outside the show dates when you read the numbers.

## Before, during and after the show

Dynamic codes can point somewhere new at any time, so one set of print can follow the whole show cycle:

- **Before the show,** the codes can open a "Meet us at booth 1234" page with a meeting link. Use the same short link in your pre-show emails.
- **During the show,** switch them to the show page and form.
- **After the show,** switch them to a follow-up page: "Missed us at the expo? Here's the price list." Brochures keep getting scanned for weeks after people get back to the office.
- **At the next show,** reuse the banner. Repoint each code at the new show's page and change the `utm_campaign` value in the destination, so the new show's scans don't mix with the old ones in your analytics.

If the graphics will travel to several shows, name the codes by placement ("Back wall banner"), not by show, and keep a note of which show each period of scans belongs to.

## Read the results

After the show, compare the placements:

- **Scans per placement.** Which codes people used at all. A banner with very few scans is either badly placed or saying the wrong thing.
- **Form submissions per placement**, from your form tool or CRM via `utm_content`. That's the number that matters.
- **Scans by day and hour.** They show when the booth was busy, which helps with staffing next time.
- **Scans after the show.** Brochure and catalogue codes that keep getting scans show which material people took home.

Write the numbers down next to what each placement cost, and you'll have something concrete to plan next year's booth with.

## Doing this with iShortn

In iShortn, each placement is one dynamic QR code:

1. Create a code per placement under **QR Codes**, with the UTM-tagged destination and a clear name.
2. Style it with your logo and colours, and download the SVG for banners and large print, or the PNG for brochures.
3. Add all of the show's codes to one **campaign**. The campaign page adds up scans across its codes and lists them side by side, and you can export the campaign's analytics as CSV for the post-show report.
4. Change destinations before, during and after the show without reprinting.

The free plan includes 5 dynamic QR codes and one active campaign, which covers a small booth. Free analytics show the last 7 days, though, and you'll probably want to look at a show's numbers more than a week later. [Pro](/pricing), at $8 a month, keeps a year of scan history and lets you print your own domain on the banner (`go.yourcompany.com/expo`) with up to 3 custom domains. Campaigns on Pro can also stamp default UTM values onto every link you add to them. If several sales reps or an agency run your shows, Ultra adds team workspaces with no limit on members.

We wrote separately about [how to track QR code scans](/blog/how-to-track-qr-code-scans) in more detail, and about [QR codes for events and posters](/solutions/events) if you organise events as well as exhibit at them.

## Quick answers

**Can QR codes replace badge scanning at a trade show?** No. Badge scanning records the people your staff talked to. QR codes catch the visitors who don't stop, and let them ask for a quote or download a spec sheet on their own. Use both.

**How many QR codes should a booth have?** One per placement you want to compare. Four to six is typical: back wall, counter, brochure, sample tags and staff badges.

**How big should a QR code on a trade show banner be?** For a banner read from the aisle, 2 to 3 metres away, make it 20 to 30 cm wide.

**Can I reuse trade show QR codes at the next show?** Yes, if they're dynamic. Point them at the new show's page and update the UTM campaign in the destination.

**How do I know which QR code brought a lead?** Give each placement its own code with its own `utm_content` value, and have your form save the UTM values in hidden fields. Each lead then carries its placement into your CRM.

## Set up your booth codes

Make the codes while the graphics are still being designed, so they go into the print files and get tested on the proofs.

**[Create your trade show QR codes free →](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=qr-codes-for-trade-shows)**

5 dynamic QR codes and one campaign free, no card needed. Pro keeps 1 year of detailed scan history for $8 a month.
