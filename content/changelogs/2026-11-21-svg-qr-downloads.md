---
date: 2026-11-21T22:00:00
version: 2.14.0
title: SVG QR code downloads, your link shown at sign-up, and click limits that hold
shortDesc: Download QR codes as SVG for engraving, signage and large-format print, see the link you're shortening on the sign-up page, and click-limited links now stop on time after your monthly event allowance runs out
category: new
---

Three changes: a new QR code format, a clearer sign-up step and a fix for click limits.

## Download QR codes as SVG

QR codes now download as SVG as well as PNG. SVG is a vector file, so it scales to any size without blurring. Use it for laser engraving, vinyl cutting, signage and large-format print.

- On the create page, pick **PNG** or **SVG** under **Download as** before you click **Generate & Download**.
- On the QR Codes page, each code's menu now has **Download PNG** and **Download SVG**, so you can download a saved code again in either format at any time.
- The SVG keeps your pixel style, corner markers, colours and logo, and scans to the same short link as the PNG.
- Effects (crystalize, liquidify) are PNG only. The SVG of a code that uses one has the same shapes and colours, without the effect.
- Codes saved before this change download as a plain SVG: square pixels and markers in the code's saved colour, with no logo.

The [QR codes guide](/docs/qr-codes) covers both formats.

## See the link you're shortening when you sign up

When you're signed out and paste a URL into the box on the homepage, or click **Shorten and track this link, free** in the UTM builder, you're sent to sign up first. The sign-up and sign-in pages now show the link you're shortening above the form, for example "Create a free account to get your short link for example.com/spring-sale". Long links are cut to their first 40 characters, and anything after a `?` or `#` is left out.

After you sign up or sign in, the create page opens with your link already filled in, as before.

## Click limits count clicks past the event allowance

Once an account uses up its monthly tracked-event allowance, links keep redirecting but new clicks aren't recorded. Those unrecorded clicks also didn't count toward a link's **Disable after clicks** limit, so a limited link could keep working past its limit. Clicks now count toward the limit whether or not they're recorded, so the link stops at the number you set.
