---
title: "SDS QR Codes and Warranty Registration Codes: A Guide for Manufacturers"
seoTitle: "SDS QR Codes: Keep Safety Data Sheets Current"
description: "How to put safety data sheets and warranty registration behind a QR code that still works after the next revision: what OSHA allows, what the code should open, and what to check before printing."
date: "2026-12-05"
author: "Kelvin Amoaba"
tags: ["qr code", "safety data sheet", "sds", "manufacturing", "warranty registration", "guide"]
published: true
---

Safety data sheets and warranty registration forms both change after the label goes to print. You revise an SDS when the hazard information changes, and a registration form moves when someone rebuilds the website. A QR code that points straight at `sds-rev3.pdf` or `/register-old` either breaks or, worse, keeps showing the old version.

This guide is for companies that make or import products and print codes for these documents: chemicals, coatings, adhesives, cleaning products, lubricants, tools and equipment. It covers what OSHA allows for electronic SDS access, what each code should open, how to keep codes working through revisions, and what scan counts can tell you.

We make iShortn, a link shortener with dynamic QR codes on your own domain. Most of this applies whatever tool you use, and we say where a dedicated SDS system is the better fit.

## The short version

1. Point each code at a page or link you control, never at a dated PDF file. Change the destination when the document changes.
2. Use one code per product SDS, plus one site-wide code for a workplace SDS station if you need one.
3. Keep SDS links open. No login, no password, no app, and a file small enough to load on a weak signal.
4. A QR code helps people reach the SDS. It doesn't replace supplying the SDS with the shipment, or any label element the rules require.
5. Put the codes on a subdomain you own, such as `sds.yourcompany.com`, so they keep working if you change QR tools.

## Why SDS codes go out of date

US rules expect safety data sheets to change. Under OSHA's Hazard Communication Standard, a manufacturer or importer that learns of significant new hazard information has to add it to the SDS [within three months](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1200) (paragraph (g)(5)).

There's also a deadline for a lot of revisions. OSHA updated the standard in 2024. Under the compliance dates in [paragraph (j)](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1200), manufacturers, importers and distributors had until May 19, 2026 to comply for substances, and have until November 19, 2027 for mixtures. Most formulated products are mixtures, so many SDSs will get a new revision before the end of 2027.

Each of those revisions is a new file. If the code on a drum label opens the file directly, every drum already in a customer's store room now opens the old revision, or a 404 once someone cleans up the server.

## What OSHA says about electronic SDS access

The employer that uses the chemical has to keep SDSs "readily accessible during each work shift to employees when they are in their work area(s)". The same paragraph allows electronic access: "Electronic access and other alternatives to maintaining paper copies of the safety data sheets are permitted as long as no barriers to immediate employee access in each workplace are created by such options" ([1910.1200(g)(8)](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1200)).

The standard doesn't mention QR codes. A QR code is one way to give electronic access, and the test is whether it creates a barrier. In practice, barriers look like this:

- **A login or password.** A worker shouldn't need an account, a password or a supervisor to read an SDS.
- **No signal.** Plant rooms, basements and steel buildings often have none. Keep a backup, such as a printed binder or copies saved offline, and make sure people know where it is.
- **A dead link.** A code that opens an error page is no access at all.
- **A heavy page.** A 20 MB PDF of every SDS you've ever written won't load on a weak signal. Link to one sheet.

OSHA's rules for suppliers still apply too. Manufacturers and importers must provide an SDS with the first shipment to each customer and with the first shipment after an update ([paragraph (g)(6)](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1200)). A QR code on the label makes the current version easy to find. It doesn't replace sending it.

This is general information, not legal advice. Your safety lead, or OSHA's own guidance for your sector, has the final word. Outside the US, check your own regulator's rules.

## What an SDS code should open

There are two sensible patterns:

| The code opens | Good for | What to watch |
|---|---|---|
| The current SDS PDF for that product | A single-language product with one SDS | Change the link's destination each time you publish a revision |
| A small page for that product's SDS | Several languages or regions, or both an SDS and a technical data sheet | The page holds the current files, so the code rarely needs changing |

Either way, the address printed on the label stays the same: `sds.yourcompany.com/ac200`. Only the destination behind it changes.

Keep old revisions somewhere your team can find them, because customers sometimes ask which version came with an earlier shipment. Don't make the printed code open them.

## Where to put SDS codes

- **On the product label or drum**, near the supplier details, with a short line such as "Scan for the safety data sheet".
- **On delivery notes, invoices and technical data sheets**, so purchasing and safety teams can reach the current SDS without emailing you.
- **On an SDS station poster** at a customer site or in your own plant. One code opens the list of sheets for that area.

On a container, the code is extra. It doesn't replace any label element the rules require, such as the pictograms, signal word or hazard statements.

## Which tool: SDS software or a QR link?

If you're the employer managing hundreds of SDSs from many suppliers, use dedicated SDS management software. It collects sheets from suppliers, tracks revisions, links them to chemical inventory and often includes offline apps. A link shortener does none of that.

A dynamic QR code on your own domain fits a different case. You're the manufacturer or importer, you write your own SDSs, and you want every label you've already printed to open the current version. It also suits a small site with a short list of chemicals that wants a simple poster code.

## Warranty registration codes

The other document code manufacturers print is warranty or product registration, on the product, the box or a card in the box.

**What the code should open.** A short form with the model already filled in, so the customer only types the serial number and their details. Use one code per model, or one per product line, and pass the model in the destination URL (`yourcompany.com/register?model=x200`) so the form knows which product it is.

**Check your wording.** In the US, the FTC's [guide to federal warranty law](https://www.ftc.gov/business-guidance/resources/businesspersons-guide-federal-warranty-law) says "requiring customers to return a registration card is an unreasonable duty that is not allowed in a full warranty". Before you print "Register to activate your warranty", check with whoever writes your warranty terms. "Register for faster support and recall notices" is safer and still gives people a reason to scan.

**Count what happens.** Compare scans per model with units shipped to see roughly how many customers try to register, and add UTM tags to the destination so form submissions show up in your web analytics. Our guide to [tracking QR code scans](/blog/how-to-track-qr-code-scans) shows the tagging scheme.

## What scan counts tell you

Scan analytics don't identify the person who scanned. They're still useful for document codes:

- **Which products people look up.** Lots of SDS scans for one product can mean the label is unclear or customers are being audited.
- **Where products end up.** Scan countries can differ from where you ship, which matters when an SDS has to be in a local language.
- **Whether a revision reached people.** After you repoint a code, scans show the new version is being opened.
- **Which channel works.** Separate codes on the label, the delivery note and the poster show which one people use.

## Why your own domain matters

Most phone cameras show the web address before they open it. A safety officer or customer is more likely to open `sds.yourcompany.com/ac200` than a random QR-service domain. Codes also have to last. A drum can sit in a store room for years, and many QR tools [switch codes off](/blog/qr-code-stopped-working) when a plan or trial ends. With codes on your own subdomain, you can point that subdomain at another service and recreate the same paths. [QR codes on your own domain](/blog/qr-code-custom-domain) explains how this works.

## Doing this with iShortn

1. **Connect a subdomain** such as `sds.yourcompany.com` under **Domains** and create the DNS records shown. iShortn issues the SSL certificate. The [custom domain docs](/docs/custom-domains) have the steps.
2. **Create one link per product** on that domain with a readable alias, such as the product code (`/ac200`). Aliases can be up to 20 characters of letters, numbers, dashes and underscores. If you have a long product list, Pro can import links from a CSV file.
3. **Download the QR code** from the link's menu as SVG for label artwork, or PNG for documents. Every code iShortn makes is dynamic.
4. **When a revision is published, edit the destination.** Every printed code opens the new file straight away. Destination changes aren't capped on any plan.
5. **Leave password protection and expiry off** for SDS links, since both would put a barrier in front of the sheet.

Scan analytics show scans over time, countries, cities and devices. [Pro](/pricing) is $8 a month or $80 a year, with 3 custom domains, unlimited QR codes and full scan history. The free plan includes 5 dynamic QR codes on an iShortn domain, enough to test a code on a sample label.

If you cancel Pro, links and codes already on your domain keep redirecting, and you can export your links as CSV or JSON at any time.

What iShortn doesn't do:

- It doesn't write, store or manage safety data sheets. You host the files, and the code points at them.
- It doesn't make GS1 Digital Link codes, which carry your product's GTIN for retail checkouts.
- It doesn't make unique codes per unit or serial number.
- It has no offline mode, so the backup for areas without signal is up to you.

For QR codes on the rest of the pack, see [QR codes on product packaging](/blog/qr-code-on-product-packaging). For manuals and machine plates, see [QR codes for instruction manuals](/blog/qr-code-for-instruction-manuals).

## Frequently asked questions

### Is a QR code for safety data sheets OSHA compliant?

OSHA allows electronic SDS access as long as it creates no barriers to immediate employee access. A QR code can meet that if it opens the right sheet without a login, works where people need it, and has a backup for when there's no signal or power.

### Can I change the SDS a QR code opens after printing?

Yes, if it's a dynamic code. You change the link's destination and every printed code opens the new file. A static code has the file's address built in and can't be changed.

### Does a QR code on the label replace sending the SDS?

No. In the US, manufacturers and importers still have to provide the SDS with the first shipment to a customer and with the first shipment after an update. The code makes the current version easy to find.

### Should each product have its own SDS QR code?

Yes, one per product SDS. A single code that opens a long list makes people search on a small screen. Use one site-wide code only for a workplace SDS station.

### Can I require customers to register to get warranty coverage?

In the US, the FTC says requiring a registration card isn't allowed in a full warranty. Check your warranty terms before you print wording that says registration is required.

## Start with one product

Pick a product with an SDS revision coming up. Put its code on your own subdomain, point it at the current sheet, and scan it on a real label before the print run.

**[Create a free iShortn account →](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=sds-qr-code)**

5 dynamic QR codes free, no card needed. Custom domains start on Pro at $8 a month.
