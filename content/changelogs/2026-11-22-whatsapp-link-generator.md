---
date: 2026-11-22T12:00:00
version: 2.16.0
title: A free WhatsApp link generator, bio page click breakdowns and a QR download fix
shortDesc: A free WhatsApp click-to-chat link and QR code generator, bio page clicks by country and device, a new card for where bio page visitors came from, real visitor sources for bio page views, and Download PNG in the QR code list that saves the file
category: new
---

A new free tool for WhatsApp links, more detail in bio page analytics, and two fixes.

## Free WhatsApp link generator

The [free WhatsApp link generator](/whatsapp-link-generator) turns a phone number and an optional message into a `wa.me` click-to-chat link. Anyone who taps it gets a WhatsApp chat with you, with your message already typed. You also get a QR code for the link, which you can download as a PNG or an SVG. It runs in your browser, and you don't need an account.

- **Any number format.** Pick a country and type the number the way you'd write it. Spaces, dashes and brackets are removed, and a leading trunk `0` is dropped. A number that starts with `+` or `00` is read as international, whatever country is selected.
- **Messages as you write them.** Line breaks and emoji are kept. Quick-fill buttons add a starting message for orders, bookings, questions and quotes, and a preview shows what the other person will see.
- **Share links.** Leave the number empty to get a link that opens WhatsApp with your message and lets the person choose who to send it to.
- **Track it.** **Shorten this link** sends the link to iShortn, so you get a short link and click analytics. If you're signed out, you sign up first and the link carries over.

## Bio page analytics: clicks by country and device, and where visitors came from

A bio page's **Analytics** tab now has two more cards under **Top links**: **Clicks by country** and **Clicks by device**. They count clicks on all the page's link blocks in the selected range. Each card shows the top 10, and the rest are added up in an **Other** row, so both cards add up to the page's total clicks.

A new **Where visitors came from** card above **Top links** shows which sites sent visitors to the page. It counts page views, because link blocks open without passing on where the visitor came from. Free plans have the same 7-day history limit as link analytics.

To open the Analytics tab directly, add `?tab=analytics` to the bio page's dashboard address.

## Bio page views record where visitors came from

The **Where visitors came from** card showed the bio page's own address (such as ishortn.ink) for every view, because views recorded the bio page as their source instead of the site the visitor came from. Views now record the real source, such as Instagram, and reloads or visits with no source count as direct.

Views recorded before this change don't say where the visitor came from. Older views on ishortn.ink are left out of the card, and its percentages are shares of the views that have a source. Older views of a page on a custom domain still show that domain. Your total view count still includes every view. The views chart also now shows every day in the range, including days with no views, so a page with views on only one day still gets a chart.

## Download PNG in the QR code list saves the file

In the QR code list, **Download PNG** in a code's menu opened the image in a new tab instead of saving it. It now downloads the code's saved image and saves it as a PNG named after the code. If the image can't be fetched, it opens in a new tab as before.
