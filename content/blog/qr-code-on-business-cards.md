---
title: "QR Codes on Business Cards: vCard or Link, Size, and Cards for a Whole Sales Team"
seoTitle: "QR Code on a Business Card: vCard or Link?"
description: "Should a business card QR code save a contact or open a link? Print sizes, what happens when someone changes jobs, and how to set up one code per person for a sales team on your own domain."
date: "2026-11-30"
author: "Kelvin Amoaba"
tags: ["qr code", "business cards", "sales", "b2b", "custom domain", "guide"]
published: true
---

A QR code on a business card saves the other person from typing your details into their phone. Whether it's worth printing depends on two choices: what the code holds, and what happens to it when your details change.

This guide covers both. It's written for companies that print cards for several people, such as sales reps, account managers, field engineers or the partners at a practice. The first half applies to a single card too.

We make iShortn, a link shortener with dynamic QR codes on your own domain. iShortn makes both kinds of code covered below, including an editable contact card code, and we say when each one is the better choice.

## The short version

1. A **vCard code** saves your contact straight to the phone and works without signal. It can't be changed after printing and doesn't count scans.
2. A **link code** opens a page. You can change where it points, see how often it's scanned, and the code stays small.
3. A **contact card code** sits in between. It opens a hosted contact page with a **Save contact** button, counts scans, and you can edit the details after the cards are printed. It needs signal, like a link.
4. For a team, give every person their own link on the company domain, such as `go.yourcompany.com/jane`, and print that address under the code.
5. Print the code at least 2 cm (about 0.8 inch) wide with a clear margin, and test a printed proof before the full run.
6. When someone leaves, repoint their link. The cards they handed out keep working.

## vCard or link: what the code holds

A QR code stores text. On a business card, that text is usually one of two things.

**A vCard** is the contact itself: name, company, title, phones, email, website and address, in a standard format phones understand. Scan it and the camera offers to add the contact. Nothing loads from the internet, so it works in a basement meeting room or an exhibition hall with no signal.

**A link** is a web address. Scan it and the phone opens a page: your profile on the company website, a contact page, a calendar booking page or your LinkedIn profile.

| | vCard code | Link code (dynamic) | Contact card code (iShortn) |
|---|---|---|---|
| Saves the contact in one step | Yes | Only if the page offers a contact file (see below) | Yes, from the page's Save contact button |
| Works without mobile signal | Yes | No | No |
| Can be changed after printing | No | Yes | Yes |
| Counts scans | No | Yes | Yes |
| Code density | High: often 300+ characters | Low: about 30 characters | Low: about 30 characters |
| Depends on an outside service | No | Yes, on whatever runs the link | Yes, on iShortn |

Neither is right for everyone. A vCard suits someone whose details rarely change and who mostly meets people in places with bad signal. A link suits anyone whose role, phone number or employer may change before the box of cards runs out, and any company that wants to know whether cards get used. For a company printing cards for a team, we'd pick the link almost every time, because the people on the cards change faster than the boxes run out.

### The density problem with vCards

The more text a QR code holds, the more squares it needs (QR specs call them modules), and the smaller each square gets at the same print size. We encoded a typical vCard with two phone numbers, an email, a title, a website and an office address: about 330 characters. It needs a 69 x 69 grid. A 34-character short link needs 29 x 29.

At 2 cm wide, the vCard's modules are 0.29 mm each and the link's are 0.69 mm. Fine modules are harder to print cleanly on textured or recycled card stock, and harder for older phones to read. If you choose a vCard, keep it to name, company, one phone, email and website, or print it larger.

### Getting "save contact" from a link

You can have both. A contact card code points to a small page with your details and a **Save contact** button, which downloads a standard `.vcf` file that iPhones and Android phones add to their contacts. Because the code holds a short link, not the contact itself, it stays small, counts scans, and the details can change after printing. In iShortn, choose **vCard** under **Create QR Code**. Contact card codes are on Pro and Ultra.

If you'd rather host it yourself, export your contact as a `.vcf` file, put it on your company website and add a **Save contact** button to the page the QR code opens. Ask whoever runs your website to serve the file as `text/vcard`, then test both kinds of phone. Your own page can also carry what a contact card can't, such as a photo, a booking link, product lines or the latest catalogue.

## Size and print

- **Width:** at least 2 cm (0.8 inch). The Nielsen Norman Group's [QR code guidelines](https://www.nngroup.com/articles/qr-code-guidelines/) put the minimum at 2 x 2 cm, plus about 1 cm for every 10 cm of scanning distance. A card is read at arm's length or closer, so 2 to 2.5 cm is enough for a short link.
- **Margin:** leave an empty border around the code. [Denso Wave](https://www.qrcode.com/en/howto/code.html), which invented the QR code, specifies four modules. Don't let the card's border or text run into it.
- **Contrast:** dark code on a light background. Light-on-dark and low-contrast brand colours fail on some phones.
- **Finish:** matte scans more reliably than gloss or foil, which reflect light back at the camera.
- **Label it:** "Scan to save my contact" or "Scan to book a call" tells people what will happen. "Scan me" doesn't.
- **Print the address too:** put `go.yourcompany.com/jane` under the code for people who'd rather type it, or who are reading a photo of your card.

Order a proof, or print a sheet on the same stock, and scan it with an iPhone and an Android phone before ordering 500 cards.

## Cards for a whole team

When a company prints cards for ten or fifty people, the problems are different. People change roles, phone numbers change, and people leave. A static code on a card points wherever it pointed the day it was printed.

What works for a team:

**One link per person, on the company's domain.** Use a subdomain you own, such as `go.yourcompany.com`, and give each person a readable link: `go.yourcompany.com/jane-mensah`. Point it at that person's page on your website. The address looks like your company, people can type it, and nobody can take it over because you own the domain. Our guide to [custom short links for your brand](/blog/custom-short-links-for-your-brand) covers picking the subdomain.

**Create them in one go.** A CSV with one row per person is quicker than making fifty links by hand:

```csv
url,alias,domain,note
https://yourcompany.com/team/jane-mensah,jane-mensah,go.yourcompany.com,Jane Mensah - Sales
https://yourcompany.com/team/tom-reid,tom-reid,go.yourcompany.com,Tom Reid - Service
```

**Repoint, don't reprint, when someone leaves.** Jane's cards are still in customers' desk drawers after she moves on. Point `go.yourcompany.com/jane-mensah` at her successor's page, or at a "your account manager is now..." page with the right contact. Customers who scan an old card reach someone who can help, and the lead doesn't go to a dead inbox.

**Watch whether cards get used.** Each person's link counts its own scans. You'll see which cards get scanned at all, and when: a spike after a trade show or a sales trip is a good sign. Scans aren't leads, though. The code doesn't know who scanned it. If you want names, the page has to ask for them, for example with a booking or quote form.

**Give the links one owner.** Whoever orders the cards, usually marketing or office management, should own the links, not each rep, so nothing is lost when a rep leaves.

The same pattern works for staff badges at [trade shows](/blog/qr-codes-for-trade-shows), estate agents' boards and cards (see [QR codes for real estate](/solutions/real-estate)), and agencies printing cards for clients (see [QR codes for agencies](/solutions/agencies)).

## Doing this with iShortn

1. **Connect your subdomain.** Add `go.yourcompany.com` under **Domains** and create the two DNS records it shows. iShortn issues the SSL certificate. The [custom domains guide](/docs/custom-domains) has the steps.
2. **Create one link per person.** Make each link with a custom alias, or upload the CSV above with [bulk import](/docs/bulk-import).
3. **Download the codes.** Each link has a QR code in its menu that you can download as a PNG. If you want a logo, brand colours or an SVG for the printer, create the code under **QR Codes** instead, choose your domain there, and download it as SVG. Those codes get a generated ending rather than the person's name, so print the readable link under them. See [QR codes](/docs/qr-codes) for the styling options.
4. **Change destinations whenever you need to.** Edits apply to every printed card at once.

Prefer to hand out a contact instead of a page? Create a **vCard** code for each person under **QR Codes** instead of step 2. Scans open their contact page, and when someone's number or title changes you edit their card once and every printed card shows the new details.

If your current cards print a branded domain that runs through Bitly, [move it over first](/docs/migrate-from-bitly) so the codes already in circulation keep working. Our [iShortn vs Bitly](/compare/bitly) page compares the two.

Custom domains and CSV import need [Pro](/pricing), which costs $8 a month or $80 a year. Pro includes 3 custom domains, 1,000 new links a month and 1 year of detailed scan history. One person can run the whole team's cards from one Pro account.

If several people need to log in and manage links, Ultra ($15 a month or $150 a year) adds team workspaces with no limit on members. Your links stay yours on either plan. They export as CSV or JSON, so if you ever move to another tool, you recreate them there, point the domain at it, and the printed cards keep working.

For a single card, the free plan works with an `isht.app` address, and our free [QR code generator](/qr-code-generator) makes static codes for a link that will never change. You can't edit those or count their scans.

## Quick answers

**Is a QR code on a business card a good idea?** Yes, if it does something useful when scanned and you can keep it working. A code that opens an out-of-date page, or a homepage, is worse than no code.

**What size should a QR code be on a business card?** At least 2 cm (0.8 inch) wide, with an empty margin around it. Make a vCard code larger or remove fields from it.

**Can I put my contact details in the QR code itself?** Yes, as a vCard. A plain vCard works offline but can't be changed after printing, and many fields make the code dense. A contact card code (iShortn Pro) opens a page with a Save contact button instead, so it stays small and editable but needs signal.

**What happens to the QR code when an employee leaves?** With a static code, it keeps opening whatever it was printed with. With a dynamic link on your own domain, you repoint it to a colleague or a team page.

**Can I see how many people scanned my business card?** With a dynamic code, yes: each scan is counted, with date, country and device. You won't see who scanned unless the page asks.

## Set up your team's card codes

Make the links before the cards go to the printer, so the codes and addresses go into the print files and get tested on the proof.

**[Create your business card QR codes free →](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=qr-code-on-business-cards)**

The free plan needs no card. Pro adds your own domain and CSV import for $8 a month.
