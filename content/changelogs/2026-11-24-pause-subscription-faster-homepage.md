---
date: 2026-11-24T12:00:00
version: 2.20.0
title: Pause billing instead of cancelling, a faster homepage and QR-to-sign-up handoff
shortDesc: Monthly subscribers can pause billing for 1 to 3 months instead of cancelling, the homepage does less work in your browser, and the free QR generator keeps your URL when you sign up
category: improved
---

Changes to billing, the homepage and the free QR code generator.

## Pause billing instead of cancelling

If you're on a monthly Pro or Ultra plan and cancel, you can now pause billing for **1, 2 or 3 months** instead. After you pick a reason for leaving, select **Continue**, choose how long to pause, and select **Pause billing**. The dialog shows the date billing restarts. **Cancel anyway** still cancels at the end of your billing period.

While paused:

- Your links keep redirecting.
- Your account uses the Free plan's limits until billing restarts.
- **Settings > Billing** shows **Paused** and **Billing restarts** with the date, plus a **Resume subscription** button, so you can restart earlier.
- Plan changes are blocked until you resume.

Annual plans keep the one-step cancel: they're already paid for the year, so a pause wouldn't save you anything. Downgrading from Ultra to Pro works as before.

Two other changes in **Settings > Billing**:

- A new **Cancel plan** button opens the cancel flow.
- **Manage Subscription** is now **Invoices & payment method**. It opens the same billing portal as before.

## Faster homepage

The homepage does less work in your browser while it loads, which cut Total Blocking Time on a throttled mobile profile by about 15%. The QR code demo is drawn on the server, and the icons further down the page load from one small file.

The session-recording script (Microsoft Clarity) now loads only inside the signed-in app. It no longer runs on the homepage, pricing, blog, comparison pages, free tools or sign-in pages.

## Free QR code generator keeps your URL when you sign up

On the [free QR code generator](/qr-code-generator), after you enter a URL, the button under the code reads **Track scans of this code, free**. Create an account from there and you land in the new-link form with your URL already filled in, so you can turn it into a trackable link. The sample URL shown before you type anything isn't carried over.
