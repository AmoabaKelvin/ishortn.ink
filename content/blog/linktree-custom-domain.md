---
title: "Linktree Custom Domain: Can You Use Your Own Domain? (And What to Use Instead)"
seoTitle: "Linktree Custom Domain: Can You Use Your Own?"
description: "Linktree doesn't support custom domains on any plan. Why that matters, the workarounds people try, and how to put a tracked bio page on your own domain."
date: "2026-11-23"
author: "Kelvin Amoaba"
tags: ["link in bio", "linktree", "custom domain", "branding", "guide"]
published: true
---

You bought yourname.com, or you already have a business domain, and you want your link-in-bio page to live there instead of on linktr.ee. So you open Linktree's settings looking for a custom domain option, and there isn't one.

You haven't missed it. Linktree's own help center says it directly: ["Linktree doesn't support custom domains."](https://linktr.ee/help/articles/6571689) No plan includes it, including the most expensive one.

This post covers why a custom domain on your bio page is worth having, the workarounds people try with Linktree and where they fall short, and how to set up a bio page on your own domain. We make iShortn, which does this on its Pro plan. We'll also say where Linktree is still the better choice.

## Why put your bio page on your own domain?

**It's yours.** Your Instagram bio, business cards and email signature point at an address you control. If you ever change tools, you point the domain at the new one and every printed or posted link keeps working. A linktr.ee/yourname link only works for as long as you stay on Linktree.

**It looks like your business.** "links.yourbakery.com" reads as a business. "linktr.ee/yourbakery123" reads as a profile on someone else's platform. For freelancers, small brands and anyone sending the link in a pitch, that makes a difference.

**Your short links can share it.** If the same domain also serves your short links (yourbakery.com/xmas, yourbakery.com/menu), everything you share carries one consistent name.

None of this matters much if you're a hobby account sharing three links. It matters more if the link-in-bio is the front door to a business.

## The Linktree workarounds, and why they're awkward

Since Linktree can't serve your page on your domain, people try other routes:

- **Forward your domain to linktr.ee.** Set yourdomain.com to forward to linktr.ee/yourname at your registrar. It works, but visitors see the address change to linktr.ee as the page loads, so the page still lives on Linktree's address. Linktree says it doesn't offer tools for domain forwarding, so this is all set up at your registrar.
- **Use Linktree's Redirect link.** Linktree's suggested workaround is a Redirect link (on its paid plans), which sends everyone who opens your Linktree straight on to a link you choose. That helps if your real page lives elsewhere, but the address you share is still linktr.ee.
- **Build a page on your own website.** Full control, but now you're maintaining a web page every time a link changes, and you lose per-link click tracking unless you set it up yourself.
- **Use a one-page site builder.** Tools like Carrd let you put a simple page on a custom domain cheaply. Carrd's analytics (Google Analytics or its own) need the $19/yr Pro Standard plan, though, and it has no per-link click tracking or short links. (Our [iShortn vs Carrd](/compare/carrd) page has the details.)

What most people actually want is a link-in-bio builder, on their domain, with tracking on every link. That's what we built.

## How a bio page on your own domain works in iShortn

An iShortn bio page is a mobile-first page with your name, a short intro and your links. It has the blocks you'd expect: link buttons, headings, text, social icons (Instagram, TikTok, X, GitHub and others), an email button and dividers. Drag to reorder, and a live preview shows the result as you go.

Every link button is a tracked short link. So for each page you see views, unique visitors and click-through rate, and for each link you see clicks by country, device and referrer. The page also gets its own QR code for print.

On the **Pro plan ($8/month)**, you can:

- Serve the page at the root of your own domain, like `links.yourbakery.com` or `yourname.com`
- Use the same domain for short links, which live at deeper paths (`links.yourbakery.com/sale`)
- Remove the "Made with iShortn" badge
- Customise the theme fully (accent colour, button style, background, font)
- Set a custom social preview image
- Have up to 3 bio pages and 3 custom domains

The free plan includes 1 bio page at `ishortn.ink/p/yourname`, with up to 3 link blocks, curated themes and the iShortn badge. It's enough to try the builder, not enough to replace a busy Linktree. Bio link blocks don't count toward the free plan's 30 links a month.

## Step by step: put your link-in-bio on your domain

### 1. Decide which address to use

You have two choices:

- **A subdomain** of the domain you already have, like `links.yourbakery.com` or `bio.yourname.com`. This is the easiest and safest option if your main domain already runs a website. Your site stays where it is.
- **A whole domain**, like `yourname.com`, if it's free and you want the bio page to be the homepage. You'll need a DNS provider that supports ALIAS, ANAME or flattened CNAME records at the root of the domain. Cloudflare, Namecheap, Porkbun and Route 53 do.

### 2. Add and verify the domain

1. Start a Pro plan (see [pricing](/pricing)) and open **Domains** in the dashboard.
2. Add your subdomain or domain.
3. iShortn shows the DNS records to create (TXT, CNAME or A records, depending on the setup). Add them at your DNS provider exactly as shown.
4. Wait for verification. DNS changes often take a few minutes and can take a few hours.

If you've set up a custom short link domain before, this is the same process. Our guide to [custom short links for your brand](/blog/custom-short-links-for-your-brand) explains it in more detail.

### 3. Build the bio page

1. Open **Bio Pages** and create a page.
2. Add a heading and a line about who you are and what you do.
3. Add your link buttons. Put the one you most want people to tap first, because people on a phone tend to tap what's at the top.
4. Add social icons and an email button if they're useful to your visitors.
5. Set your theme and remove the badge.

### 4. Connect the domain and publish

In the page's settings, choose your verified domain under **Custom domain** and publish. Visit the domain on your phone to check it loads, and tap every button.

### 5. Update everywhere you share the old link

Replace the linktr.ee address in your Instagram, TikTok and X bios, your email signature, your Google Business Profile and anything you're about to print. Don't delete your Linktree straight away. Older posts and printed material may still point at it, so keep it live for a while, and edit it down to a single link to your new page.

## Reading the numbers after a week

Because each button is a tracked short link, a week of data answers practical questions:

- **Which links do people actually tap?** Move the winners up and cut the ones nobody uses.
- **Where do visitors come from?** Referrer data shows whether Instagram, TikTok or your email signature sends the traffic.
- **What's the click-through rate?** If plenty of people view the page but few tap, your top button probably isn't what they came for.

For more on reading click data, see [how to track link clicks](/blog/how-to-track-link-clicks). For using short links across social platforms, see [short links for social media marketing](/blog/short-links-social-media-marketing).

## When Linktree is still the better choice

To be fair to Linktree:

- **You need lots of links for free.** Linktree's free plan allows unlimited links. Ours allows 3 link blocks per page.
- **You sell directly from your bio.** Linktree and Beacons have built-in commerce features. iShortn is a link-in-bio page with link tracking, not a storefront. (See [iShortn vs Beacons](/compare/beacons) if commerce is part of your decision.)
- **You want a large template library.** Linktree has many more visual templates.

If the custom domain is the thing you're after, Linktree can't do it, and iShortn Pro can, along with tracked links, short links and QR codes on the same domain. The full side-by-side is on our [iShortn vs Linktree](/compare/linktree) page. If you're a creator or freelancer, [link in bio for creators](/solutions/creators) shows how the bio page, short links and QR codes fit together.

## Quick answers

**Can I use my own domain with Linktree?** No. Linktree's help center says it doesn't support custom domains. You can forward a domain to your Linktree page at your registrar, but the address in the browser changes to linktr.ee.

**Can I use a subdomain like links.mybrand.com?** Not on Linktree. On iShortn Pro, yes, and it's the recommended setup if your main domain already has a website.

**Do I need to buy a new domain?** No. A subdomain of the domain you already own works.

**Can I keep my short links and bio page on the same domain?** Yes. The bio page sits at the root (`links.mybrand.com`), and short links sit at paths underneath (`links.mybrand.com/offer`).

## Put your bio page on your own domain

Start on the free plan to build the page and see how the editor works, then upgrade to Pro ($8/month) when you're ready to connect your domain.

**[Create your free iShortn account →](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=linktree-custom-domain)**

Every link on your page tracked, on your own domain, from $8/month.
