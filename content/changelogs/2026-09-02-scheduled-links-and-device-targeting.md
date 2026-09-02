---
date: 2026-09-02T12:00:00
version: 2.7.0
title: Scheduled links and device targeting
shortDesc: Set a go-live time on any link, and route visitors by device or operating system
category: new
---

Two additions to how a link behaves once it is out in the world.

## Scheduled links and QR codes

Every link and QR code can now carry a **go-live time**. Share it early, print it on a flyer, drop it in a pre-launch email: until the moment you picked, visitors see a "Not live yet" page that shows when the link opens. After that it works like any other link. Pair it with the existing "disable after date" setting and you have a link that opens and closes on its own.

You will find **Go live at** under Optional Settings when creating or editing a link, and when editing a QR code. Scheduled links and QR codes show a badge in their lists so you can spot them at a glance. The REST API accepts `activatesAt` on create and update.

## Device and operating system targeting

Targeting rules can now match on **device** (mobile, tablet, desktop) or **operating system** (iOS, Android, Windows, macOS, Linux, ChromeOS) alongside country and continent. The common case: send iPhone visitors to the App Store, Android visitors to Google Play, and everyone else to your site, from one short link.

Rules live in the same editor as geotargeting. They are checked top to bottom and the first match wins, so put your most specific rule first.

## Plans

- Scheduled links and QR codes are available on Pro and Ultra.
- Device and OS rules count toward the same per-link rule limit as geotargeting: 3 on Pro, unlimited on Ultra.
