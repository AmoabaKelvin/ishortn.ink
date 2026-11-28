---
title: "QR Codes for Instruction Manuals: How to Set Them Up So They Still Work in 10 Years"
seoTitle: "QR Codes for Instruction Manuals That Last"
description: "How to put a QR code on a user manual or machine: what it should open, static or dynamic, label and plate sizes, the EU's 2027 digital-instructions rules, and keeping it working for years."
date: "2026-12-14"
author: "Kelvin Amoaba"
tags: ["qr code", "manufacturing", "instruction manual", "dynamic qr code", "guide"]
published: true
---

A QR code on a manual has a harder job than one on a flyer. A flyer is in the bin within a month. The code on a pump, a heater or a set of shelves gets scanned years later, when someone is trying to fix it, set it up again or find a spare part. By then the website has been redesigned at least once and the person who made the code may have left.

This guide is for companies that print "scan for instructions" on products, manuals and spec sheets: what the code should open, which kind of code to use, how big to print it, what the EU's 2027 machinery rules say about digital instructions, and how to keep the code working for the product's whole life.

We make iShortn, a link shortener with dynamic QR codes on your own domain. Most of this advice works with any tool. The iShortn-specific part is near the end.

## The short version

1. Point the code at a page for that model, not straight at a PDF file.
2. Put the code on a domain you control, such as `qr.yourcompany.com`, so it doesn't depend on one QR vendor staying in business or one subscription staying paid.
3. Print the model number and a short typed address next to the code.
4. Size it for the distance people scan from: about 2.5 cm (1 inch) in a booklet, much bigger on a machine plate read from a metre away.
5. Plan for the code to outlive your current website, your current QR tool and probably your current job.

## What the code should open

Link to a page for the product model, and put the manual on that page. Don't link the code straight to `manual-v3-final.pdf`.

A PDF link breaks the first time someone uploads a new revision under a new file name, or the website platform changes how it stores files. A model page can stay at the same address for years while what's on it changes. It also has room for what people scanning a manual are looking for:

- The full manual as a PDF they can download, print and save.
- A setup or maintenance video, if you have one.
- Spare parts, consumables and how to order them.
- Warranty registration.
- A support contact, and the model and revision the page covers.
- Other languages, if you sell in more than one market.

Keep the page light. People often scan in a plant room, a basement or a warehouse with one bar of signal. A 40 MB PDF and an autoplaying video won't load there.

If the manual changes by serial number or production date, list the revisions on the model page ("Units from serial 24000 onwards: revision C"). Then a customer with an older unit can still find the manual that matches it.

## Static or dynamic?

**A static code** has the full web address built into the pattern. It can't expire, but it can never point anywhere else. If the address changes, the printed code is wrong for good, unless your web team keeps a redirect in place.

**A dynamic code** holds a short link. The QR service redirects each scan to the page you've set, so you can change that page later without reprinting, and count scans.

A manual lives long enough that its page will move at least once, so dynamic is usually the better choice. The catch is the service in the middle. Many QR vendors run dynamic codes on their own short domain and switch them off when a plan or trial ends (we explain how in [why QR codes stop working](/blog/qr-code-stopped-working)). On a menu that's annoying. On products that have already shipped, you can't reprint.

So run dynamic codes on a subdomain you own. The printed code then says `qr.yourcompany.com/x200`. If you leave the vendor, you point that subdomain at a new service, set up the same paths, and the printed codes keep working. A code on the vendor's domain can't be moved.

Check what your vendor does with custom-domain codes when you cancel, too. Hovercode's [pricing FAQ](https://hovercode.com/pricing/), for example, says that after you cancel, "any QR codes, short links, or pages using your custom domain will stop working", and that they come back if you resubscribe.

## What the EU's 2027 machinery rules say

If you sell machinery or related products in the EU, Regulation (EU) 2023/1230 on machinery replaces the Machinery Directive and applies from 20 January 2027. That date comes from the [corrigendum](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R1230R%2801%29). The [original text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R1230) says 14 January, and some guides still quote it.

Article 10(7) says "the instructions may be provided in a digital format". When they are, the manufacturer has to:

- mark on the machine, or where that isn't possible on its packaging or an accompanying document, how to access the digital instructions;
- present them in a format the user can print, download and save on a device;
- make them accessible online "during the expected lifetime of the machinery or related product and for at least 10 years after the placing on the market".

Two more conditions apply. If the user asks at the time of purchase, the manufacturer has to provide the instructions on paper, free of charge, within one month. And for machinery intended for non-professional users, or likely to be used by them, the safety information needed to put the machine into service and use it safely still has to come on paper.

Article 10(7) doesn't prescribe a QR code. A code is one common way to show users how to reach the instructions. But the link behind it has to work for the product's whole life and at least ten years, and open instructions people can download and save. A code on a vendor's domain that stops when an invoice goes unpaid is a poor fit. A code on your own domain, pointing at a model page with a downloadable PDF, fits much better.

This is a summary, not legal advice. Check your own products with whoever handles your CE conformity.

## Size, material and placement

The Nielsen Norman Group's [QR code guidelines](https://www.nngroup.com/articles/qr-code-guidelines/) recommend at least 2 x 2 cm, plus about 1 cm of width for every 10 cm of scanning distance.

| Where the code is | Typical scanning distance | Minimum width |
|---|---|---|
| Inside a printed manual or quick-start card | Arm's length | 2.5 cm (1 inch) |
| On the product housing or packaging | 30 to 50 cm | 3 to 5 cm |
| On a machine nameplate or wall-mounted unit | About 1 metre | 10 cm |

A few things go wrong more often on products than on paper:

- **Leave the quiet zone.** [Denso Wave](https://www.qrcode.com/en/howto/code.html), which invented the QR code, specifies an empty margin four modules wide around the code. Labels that crowd the code with text or a border are a common cause of failed scans.
- **Watch the surface.** Brushed metal, glossy film and curved housings reflect light into the camera. Test the real material, not a paper proof.
- **Use an SVG for engraving and labels.** It scales to any size without blurring.
- **Put it where the user is**, next to the panel or access door the manual explains, not under a unit that gets bolted to a wall.

Print the model number and a short typed address under the code, such as `qr.yourcompany.com/x200`, for people whose camera won't focus.

## Naming and planning the codes

Decide the scheme before the first print run, because you'll live with it for years. Use one code per model, with the model number as the path (`qr.yourcompany.com/x200`), and avoid dates, campaign names and people's names. Keep a list of which code went out on which product and revision. And create the codes in an account the company owns, with more than one person who can sign in. A code made in an ex-employee's personal account is very hard to recover.

Scan counts are a bonus. They show which models people look up after purchase, which countries your products end up in, and whether scans jump after a batch ships, which can point to a confusing setup step. They don't show who scanned, so warranty registration still needs a form.

## Doing this with iShortn

iShortn makes dynamic QR codes that you can repoint at any time, on your own subdomain:

1. Add a subdomain such as `qr.yourcompany.com` under **Domains** and create the DNS records it shows (a CNAME, and a TXT record if asked). iShortn issues the SSL certificate, and your website and email aren't affected. The [custom domain guide](/docs/custom-domains) has the steps.
2. Create a QR code for each model under **QR Codes**, choose your subdomain as the link domain, and add your logo and colours if you want them.
3. Download the PNG for documents, or the SVG for engraving, labels and large print. The [QR code docs](/docs/qr-codes) list the styling and download options.
4. When a manual moves or gets a new revision, change the destination. Every printed code follows.

Styled codes get a short random path. If you want a readable path like `/x200`, create a short link with that alias on your domain and download its plain QR code from the link's menu.

Will we still be around in ten years? We plan to be, but you shouldn't have to take that on trust:

- **If you cancel Pro**, links and codes already on your domain keep redirecting. You can't add new links on that domain until you upgrade again.
- **You can export your links** (alias, domain, destination) as CSV or JSON at any time. That list is what you'd need to rebuild the same paths somewhere else.
- **The code is MIT-licensed.** If you'd rather run it yourself, the [self-hosting guide](/docs/self-hosting) explains how.

[Pro](/pricing) costs $8 a month, or $80 a year, and includes 3 custom domains, unlimited QR codes and 1 year of detailed scan history. The free plan includes 5 dynamic QR codes on an iShortn domain, which is enough to test a code on a prototype label before you commit. If you just need a static code for a page that won't move, our [free QR code generator](/qr-code-generator) makes one with no account.

For codes on packaging and product labels, see [QR codes on product packaging and labels](/blog/qr-code-on-product-packaging). For swing tags, receipts and counter signs in a shop, see [QR codes for small businesses](/solutions/small-business).

## Quick answers

**Can a QR code replace a paper manual?** Often, within the rules for your product and market. For machinery sold in the EU from 20 January 2027, see the section above: digital is allowed, with paper on request and paper safety information for non-professional users.

**Should the QR code link straight to the PDF?** Link to a model page that offers the PDF. File links break when a new revision is uploaded under a new name. A page can keep its address for years.

**What size should a QR code on a manual be?** At least 2.5 cm (1 inch) in a booklet read at arm's length. On a machine read from a metre away, about 10 cm.

**What happens to my product QR codes if the QR vendor shuts down?** Codes on the vendor's domain stop working, and only reprinting fixes them. Codes on your own subdomain can be moved: point the domain at another service and recreate the same paths.

## Set up your first product code

Pick one product with a manual or spec sheet you'll print soon. Put its code on your own subdomain, point it at a model page, and test it on the real label before the run.

**[Create a free iShortn account →](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=qr-code-for-instruction-manuals)**

5 dynamic QR codes free, no card needed. Custom domains start on Pro at $8 a month.
