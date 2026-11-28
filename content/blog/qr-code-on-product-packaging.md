---
title: "QR Codes on Product Packaging and Labels: A Practical Guide for Manufacturers"
seoTitle: "QR Codes on Product Packaging and Labels"
description: "What a packaging or label QR code should open, one code per product or SKU, print sizes, when you need a GS1 code for the checkout, and keeping codes working for years."
date: "2026-11-26"
author: "Kelvin Amoaba"
tags: ["qr code", "packaging", "manufacturing", "product label", "guide"]
published: true
---

A QR code on a flyer has to work for a month. A code on a box, a label or a bag of parts has to work for as long as that product sits in a warehouse, on a distributor's shelf and then in a customer's workshop. That's often years, and nobody can recall the packaging once it ships.

This guide is for companies that make and ship physical products: industrial parts, tools and equipment, consumables, food and drink, cosmetics. It covers what the code should open, how many codes you need, print sizes, when you need a GS1 code that scans at a retail checkout instead of a normal QR code, and how to keep the code working after the next website redesign.

We make iShortn, a link shortener with dynamic QR codes on your own domain. Most of this advice applies whatever tool you use. The iShortn part is near the end.

## The short version

1. Decide first whether the code has to scan at a retail checkout. If it does, you need a GS1 code, which is a different thing from a normal QR code.
2. Point the code at a page for the product, not at a PDF or your homepage.
3. Use one code per product or model. Only split by SKU when the variants need different pages.
4. Put the code on a domain you own, such as `qr.yourcompany.com`, so it doesn't stop working if you change QR tools.
5. Print it at least 2 cm (about 0.8 inch) wide on anything held in the hand, and test-scan the real material before the full run.

## First question: does it need to scan at the checkout?

Most supermarkets and big retailers still scan the 1D barcode (the UPC or EAN) at the till. GS1, the organisation that issues those barcodes, is moving retail to 2D codes. GS1 US calls the effort [Sunrise 2027](https://www.gs1us.org/industries-and-insights/by-topic/sunrise-2027): retailers get their point-of-sale scanners ready to read 2D barcodes, so a single code on the pack can work at the till and for shoppers' phones.

A QR code only works at the till if it carries your product's GTIN (the number in your barcode) in the format the [GS1 Digital Link](https://www.gs1.org/standards/gs1-digital-link) standard defines. A typical example looks like `https://id.yourbrand.com/01/09506000134352`. A QR code made with a link shortener or most QR generators holds a short link such as `qr.yourbrand.com/x200`. Phones can open it, but a till can't read a product number from it.

Some practical points:

- **The UPC isn't going away yet.** GS1 US [says](https://www.gs1us.org/upcs-barcodes-prefixes/2d-barcodes) "the UPC barcode isn't going away", and that shoppers may see both on packs during the transition.
- **If you sell through retailers that scan at the till**, talk to your GS1 member organisation before you add a QR code to retail packaging. GS1's aim is one 2D code per pack. Printing a marketing QR code now and a GS1 one later means two codes competing for the same shopper.
- **If your product never goes through a retail till**, which is true of most industrial, trade and B2B goods sold through distributors, a normal dynamic QR code is all you need. The rest of this guide is mainly for you.

iShortn doesn't make GS1 Digital Link codes. Our codes are the second kind: a short link on your domain that you can repoint and count scans on.

## What the code should open

Link to a page for the product or model, and put everything about it there. Don't link straight to `datasheet-rev4.pdf`: the file name changes with the next revision and the code breaks. Don't link to your homepage either. Someone who scans a label is looking for something about that product, and a homepage makes them search for it on a small screen.

What belongs on the page depends on who scans. For a manufacturer, that's usually one of four people:

| Who scans | When | What they want |
|---|---|---|
| A buyer comparing products | In a store, at a trade counter or at a distributor | Specs, certifications, price or where to buy |
| An installer or technician | On site, often with poor signal | Install guide, wiring or fitting diagram, a short video, torque or setting values |
| The end user | After purchase | Setup, care instructions, warranty registration, support contact |
| A reseller or purchasing team | When restocking | Part numbers, pack sizes, safety data sheet, a reorder link |

You don't need four codes for this. One product page with clear sections works, as long as the most common task comes first. For a consumable, that's usually reordering. For equipment, it's setup.

Keep the page light. People scan packaging in warehouses, plant rooms and basements. A 30 MB brochure won't load there.

If you also print instructions in the box, our guide to [QR codes for instruction manuals](/blog/qr-code-for-instruction-manuals) covers manual codes in more detail, including the EU's 2027 rules for digital machinery instructions.

For safety data sheet and warranty registration codes, including what OSHA allows for electronic SDS access, see [SDS QR codes](/blog/sds-qr-code).

## One code per product, per SKU or per batch?

| Code per... | Use it when | Trade-off |
|---|---|---|
| Product or model | The variants share a page (sizes, colours, pack counts) | One artwork file and one code to maintain. You can't tell variants apart in scan counts |
| SKU | Variants need different instructions, specs or safety data | More codes to track. Each must match the right label on the line |
| Batch or lot | You need traceability or recall lookups by batch | Needs variable-data printing. At this level, GS1 Digital Link with a batch number is the standard approach, not one short link per batch |

Most small manufacturers do best with one code per product, plus a separate code on anything that isn't the pack itself: an insert card, a thank-you card in a webshop order, a spec sheet in a quote. Those extra codes are cheap to vary. A different code on the insert you send with marketplace orders and the one in direct orders tells you which channel's customers actually scan.

## Static or dynamic?

A static QR code has the web address built into the pattern. It can't expire, but if that address ever changes, the code on every printed pack is wrong for good.

A dynamic QR code holds a short link, and the QR service redirects each scan to the page you've set. You can change the page later, and you can count scans. Packaging has a long life, so the page behind it will move at least once. That's why dynamic is usually the right choice for packaging.

The risk with dynamic codes is the service in the middle. Many QR tools run codes on their own domain and switch them off when a trial or plan ends. We explain how that happens in [why QR codes stop working](/blog/qr-code-stopped-working). On a restaurant menu that's a reprint. On 50,000 cartons already at distributors, there's nothing to reprint.

So put dynamic codes on a subdomain you own. The code then opens `qr.yourcompany.com/x200`. If you ever leave the QR tool, you point that subdomain at another service, recreate the same paths, and every printed code keeps working. [QR codes on your own domain](/blog/qr-code-custom-domain) explains how custom-domain codes work and what different tools charge for them.

## Size, placement and printing

The Nielsen Norman Group's [QR code guidelines](https://www.nngroup.com/articles/qr-code-guidelines/) recommend at least 2 x 2 cm, and about 1 cm more width for every 10 cm of scanning distance.

| Where the code is | Typical scanning distance | Minimum width |
|---|---|---|
| Small label, bottle, pouch or tag held in the hand | Up to about 20 cm | 2 cm |
| Carton or retail box on a shelf | About 30 to 50 cm | 3 to 5 cm |
| Outer case or pallet label read in a warehouse | About 1 metre | 10 cm |

Packaging fails scans in ways paper doesn't:

- **Keep it flat.** Don't put a code across a fold, a seam or a tight curve. On a round bottle, keep the code small relative to the curve, or put it on a flat cap or neck tag.
- **Watch the finish.** Gloss laminate, foil and shrink film reflect light into the camera. Matte areas scan better.
- **Leave the quiet zone.** [Denso Wave](https://www.qrcode.com/en/howto/code.html), which invented the QR code, specifies an empty margin four modules wide around the code. Label designers often crowd it with text.
- **Use dark on light.** A dark code on a light background with strong contrast. Brand colours are fine if they're dark enough.
- **Say what the code does.** "Scan for the install video" gets more scans than a bare code. Print a short typed address under it too, such as `qr.yourcompany.com/x200`, for people whose camera won't focus.

Send the designer or printer an SVG, not a screenshot. Then scan the press proof, and ideally a sample on the real material, with an iPhone and an Android phone before you approve the run.

## Keep a register

Codes on packaging outlive the people who made them. Keep a simple spreadsheet with one row per code: the path (`/x200`), the product and SKUs it appears on, the destination page, which artwork version it's on, and when it first printed. Create the codes in an account the company owns, with at least two people who can sign in. A code that lives in a former employee's personal account is very hard to get back.

## What scan counts tell you

Scans won't identify the person, so warranty registration still needs a form. They're still useful:

- Which products people look up after buying, which often points to the confusing ones.
- Which countries your product ends up in, which can differ from where you ship it.
- Whether scans jump after a batch goes out, which can flag a setup problem early.
- Which inserts or channels produce scans, if you used different codes.

If you also use Google Analytics, add UTM tags to the destination so scans show as their own source there. [How to track QR code scans](/blog/how-to-track-qr-code-scans) shows the tagging scheme.

## Doing this with iShortn

1. Add a subdomain such as `qr.yourcompany.com` under **Domains** and create the DNS records it shows. iShortn issues the SSL certificate. Your website and email aren't affected. The [custom domain guide](/docs/custom-domains) has the steps.
2. For each product, create a short link on that domain with a readable alias, such as the model or SKU (`/x200`). Aliases can be up to 20 characters of letters, numbers, dashes and underscores. Download the link's QR code from its menu.
3. For styled codes with your logo and colours, use **QR Codes** and pick your subdomain as the link domain. Styled codes get a short random path instead of a readable one. Download PNG or SVG; the [QR code docs](/docs/qr-codes) cover the options.
4. When a page moves, edit the destination. Every printed code follows straight away.

On Pro, you can also add up to 3 targeting rules per link. For example, scans from Germany can open your German product page, while everyone else gets the English one, from the same printed code.

What happens if you leave or stop paying:

- **If you cancel Pro**, links and codes already on your domain keep redirecting. You can't add new links on that domain until you upgrade again.
- **You can export your links** (alias, domain, destination) as CSV or JSON at any time. That's the list you'd need to rebuild the same paths elsewhere.
- **The code is open source**, and the [self-hosting guide](/docs/self-hosting) explains how to run it yourself.

[Pro](/pricing) is $8 a month or $80 a year, with 3 custom domains, unlimited QR codes and a year of detailed scan data. The free plan includes 5 dynamic QR codes on an iShortn domain, enough to test a code on a sample label before you commit. If you sell through shops more than distributors, [QR codes for small businesses](/solutions/small-business) covers swing tags, receipts and counter signs.

What iShortn doesn't do: GS1 Digital Link codes, unique codes per unit, or anti-counterfeiting. If you need those, look at GS1-conformant QR platforms.

## Questions

### What size should a QR code on a product label be?

At least 2 cm (about 0.8 inch) wide on anything held in the hand. Add about 1 cm of width for every 10 cm of scanning distance, so a code on an outer case read from a metre away needs about 10 cm.

### Does a QR code on packaging replace the barcode?

Not yet. Retail tills scan the UPC or EAN, and a normal QR code doesn't carry the product number they need. Only a GS1 Digital Link QR code can do both jobs, and GS1 US says the UPC isn't going away during the transition.

### Can I change where a QR code on printed packaging goes?

Yes, if it's a dynamic code. You change the destination in the QR tool and every printed code follows. A static code can't be changed after printing.

### Do I need a different QR code for every product?

Usually one per product or model. Use separate codes for SKUs only when the variants need different pages, such as different instructions or safety data.

### What happens to my packaging QR codes if the QR company shuts down?

Codes on the company's domain stop working, and only new packaging fixes them. Codes on your own subdomain can be moved: point the domain at another service and recreate the same paths.

## Start with one product

Pick a product with packaging or labels due for a reprint. Put its code on your own subdomain, point it at a product page, and scan it on a real sample before the run.

**[Create a free iShortn account →](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=qr-code-on-product-packaging)**

5 dynamic QR codes free, no card needed. Custom domains start on Pro at $8 a month.
