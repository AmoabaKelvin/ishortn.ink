---
title: "How to Check if a QR Code Works, Before and After You Print It"
seoTitle: "Check if a QR Code Works (and Keep It Working)"
description: "Test a QR code before it goes to print, check where it really goes without trusting the preview, and catch a printed code whose page has died. Includes a checklist and the monitoring options."
date: "2026-12-02"
author: "Kelvin Amoaba"
tags: ["qr code", "dynamic qr code", "troubleshooting", "guide"]
published: true
---

Most advice on testing a QR code stops at "scan it with your phone". That catches a code that won't scan. It doesn't catch the more common failure, where the code scans perfectly and opens a 404 page, because the page behind it was moved or deleted months after the print run.

This guide covers both. First the checks to run before a code goes to print, then how to check a code that is already out in the world, and finally how to get told automatically when a printed code's page stops working.

We make iShortn, a link shortener with dynamic QR codes, and we recently added daily destination checks for QR codes. We'll say where that fits, but every manual check here works whichever QR tool you use.

## The quick answer

To check if a QR code works:

1. Scan it with the camera app on two different phones (one iPhone, one Android if you can).
2. Read the address in the preview before you tap it, and confirm it is the page you meant.
3. Open the page on mobile data, in a private browser tab, and make sure it loads without a login.
4. Test the printed proof at its real size, in the light where people will see it.
5. After printing, scan it again every few weeks, or use a tool that checks the destination for you.

The rest of this article explains each step and what to do when one fails.

## Before you print: test the code itself

### Scan it on more than one phone

Phone cameras read QR codes differently. A code one phone reads instantly can take a few seconds on another, and some customers will give up. Scan the code with the built-in camera app on at least two phones. Don't rely on a QR scanner app alone, because most people use their camera.

### Read the preview address

When the camera finds a code, it shows a preview of the link before opening it. Read it. Typos in a URL are invisible in the black-and-white pattern, and the preview is the only place you'll see them before a customer does.

What you should see depends on the type of code:

- A **static** code shows your full destination address, such as `yourshop.com/menu`.
- A **dynamic** code shows a short link, such as `ishortn.ink/menu` or `go.yourshop.com/menu`. That short link then redirects to your page.

If you see a domain you don't recognise, find out who owns it before you print. That company's plan controls whether the code keeps working. Our guide to [why QR codes stop working](/blog/qr-code-stopped-working) explains the difference in detail.

### Open the page the way a customer would

Your office computer is a bad test. You're logged in to everything, you're on the company Wi-Fi, and your browser has the page cached. A customer has none of that.

Open the link on your phone with Wi-Fi turned off, in a private or incognito tab. Common failures this catches:

- a Google Drive or SharePoint file that is still set to "only people in my organisation"
- a form that has been closed to new responses
- a staging or preview address that only works inside your network
- a page that loads but is slow or unreadable on a phone

### Test the printed proof at full size

Print a proof at the real size and test that, not the file on your screen. A few rules of thumb:

- **Size:** for something held at arm's length, like a flyer or a booklet, make the code at least 2.5 cm (1 inch) wide. A common guide for posters and signs is about 1 cm of code for every 10 cm of scanning distance.
- **Contrast:** dark code on a light background. Light-on-dark codes, low-contrast brand colours and codes printed over photos fail more often.
- **Quiet zone:** leave a clear margin around the code, at least four of its small squares wide. Codes crammed against text or a border are harder to read.
- **Finish:** glossy laminate and curved surfaces reflect light. Test the real material under the lighting it will hang in.
- **Logos:** a logo in the middle relies on the code's error correction. If you add one, test on every phone again.

## After you print: check where the code really goes

A code that scanned fine on proof day can fail later without the print changing at all. The usual causes:

- someone redesigns the website and the page moves to a new address
- a campaign or product page gets unpublished
- the domain in the code lapses
- a QR provider's free trial or plan ends, and the code starts showing their "expired" page

You can check a printed code by scanning it and repeating the private-tab test above. If you only have a photo or a PDF of the code, open it on a screen and scan it with your phone, or use a QR reader that decodes an uploaded image and shows the link. Check the link it reveals, not just that it decodes.

How often? For anything with a long shelf life, like product packaging, manuals, signs and business cards, a quick scan every month is a reasonable habit. Put it on the same list as renewing your domain. The trouble is that nobody keeps that habit for 40 codes across six print jobs, and a broken page doesn't tell you it's broken. You usually find out from a customer, if they bother to tell you.

## Get told when a printed code's page stops working

If your codes are dynamic, the QR tool sees every scan pass through its redirect, so it can also check the page behind it. Several tools now do this. They differ in how often they check and which codes they cover:

| Tool | How often it checks | Which codes | How you hear about it |
| --- | --- | --- | --- |
| iShortn | Daily | Every link with a QR code, plus links clicked in the last 30 days | Email after two failed checks in a row, and a "Destination down" badge in the dashboard. Pro and Ultra plans |
| QR Planet | Weekly | Codes scanned in the last week | Email, and the code is marked in your account |
| Scanely | Daily | Eligible destinations on paid plans | Email after two failed daily checks |

QR Planet's and Scanely's details come from their own help pages ([QR Planet](https://qrplanet.com/help/article/broken-link-check-for-qr-codes), [Scanely](https://scanely.io/blog/qr-code-monitoring)). Check them before you rely on them, because plans change.

### How iShortn's check works

Once a day iShortn requests the destination of every link that has a QR code attached, and of every link that was clicked in the last 30 days. A destination counts as failed when it returns a 404 or 410, a server error (5xx), or when the request can't complete because of a DNS failure, a timeout, a TLS error or too many redirects.

One failure could be a blip, so a link is only marked as broken after two failed checks in a row. Then two things happen:

- The link shows a "Destination down" badge in your dashboard, with what the last check saw (for example "404 Not Found") and when.
- You get one email listing the links that broke. Links in a team workspace alert the team owner. You won't get another email for the same outage, and once the page works again the link resets, so a later outage alerts you again.

Pages behind a login, rate limits and bot challenges aren't counted as failures, because the page may well work for real visitors. The emails are part of "Product notification emails" under Settings, Notifications, so turning that off stops them. The [broken-destination alerts docs](/docs/short-links#broken-destination-alerts) cover the details.

Because an iShortn QR code points at your short link, the fix is to change the link's destination in the dashboard. Every printed copy of the code opens the new page straight away, and nothing needs reprinting.

### What automatic checks can't catch

Destination checks look at the server's answer, so some failures slip past:

- **Soft 404s.** Some sites show a "page not found" or "product unavailable" message while still answering with a normal status. To a checker the page looks fine.
- **The wrong page.** If the link opens your homepage instead of the product page, it "works", but the customer still can't find what they scanned for.
- **Scanning problems.** A scratched sticker or a code in direct sunlight is a print problem, not a page problem.

So keep the occasional manual scan for the codes that matter most. Automatic checks catch the outages you'd never think to look for.

## If your code is static

A static code has no redirect in the middle, so no QR tool can see or check it. If you made a static code for a page you control, you have two options:

- Watch the page itself with a website uptime monitor.
- If the page has to move, set a permanent (301) redirect on your website from the old address to the new one. The printed code keeps working.

If you can't do either, the only fix for a dead static code is reprinting. For your next print run, a dynamic code on a plan that doesn't switch it off avoids this.

## Frequently asked questions

**How do I know if my QR code is working?** Scan it with your phone's camera, read the address in the preview, then open it on mobile data in a private tab. If the right page loads without a login, it works today. To know it still works next month, scan it again or use a tool that checks the destination for you.

**How can I check a QR code without scanning it?** Open the image on a screen and scan that with your phone, or upload the image to a QR reader that shows the link it contains. Then check that link in a private browser tab.

**Can a QR code stop working on its own?** The printed pattern doesn't wear out. A code stops working when the page behind it moves or is deleted, the domain in it lapses, or the QR provider stops redirecting it, often because a trial or plan ended.

**How often should I check printed QR codes?** Monthly is a sensible minimum for codes on packaging, manuals, signs and other long-lived print. A daily automatic check covers the time in between.

**Does iShortn check QR codes on the free plan?** The badge and email alerts are on Pro and Ultra. Free accounts can still make 5 dynamic QR codes and change where they point at any time.

## Check your own codes

Pick the code you printed the most copies of. Scan it today, open it on mobile data, and read the address it shows. If it's a dynamic code from a provider that lets it lapse, or a page you're not sure will survive the next redesign, move it to a short link you control.

**[Create a free iShortn account →](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=how-to-check-if-a-qr-code-works)**

5 dynamic QR codes free, no card needed. Daily destination checks with email alerts are on Pro, from $8 a month.
