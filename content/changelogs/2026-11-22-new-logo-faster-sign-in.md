---
date: 2026-11-22T06:00:00
version: 2.15.0
title: A new iShortn mark, SVG downloads in the free QR generator, and steadier sign-in pages
shortDesc: The viewfinder logo across the site, app and emails, SVG download and link prefill in the free QR code generator, sign-in pages that no longer jump while loading, id and createdAt in API link responses, per-page social previews, and no more "null" names for email sign-ups
category: new
---

A new logo, two additions to the free QR code generator, steadier sign-in pages, two new API fields, better link previews and a fix for names.

## A new iShortn mark

iShortn has a new logo: the viewfinder, two QR-style scan brackets around one rounded square. It replaces the old mark everywhere:

- The site header and footer, the sign-in and sign-up pages and the docs.
- The dashboard sidebar and the mobile top bar, which now show the mark next to the iShortn name.
- The team invite and account transfer pages.
- The browser tab icon, and the icon you get when you add iShortn to your phone's home screen.
- The header of account emails such as team invites, billing notices and usage alerts.

## Free QR code generator: SVG download and prefill

The [free QR code generator](/qr-code-generator) now has **Download SVG** next to **Download PNG**. The PNG is 1024 pixels square, which suits screens and everyday print. The SVG is a vector file that stays sharp at any size, so use it for signs, banners, stickers and engraving. Both are made in your browser, and you still don't need an account.

To open the generator with a link already filled in, add it to the address: `ishortn.ink/qr-code-generator?url=https://example.com`. If the link isn't a valid URL, the generator opens with its usual example instead.

## Sign-in and sign-up pages no longer jump

The sign-in and sign-up pages used to show nothing where the form goes while it loaded, then push the page down when it appeared. They now show the form's outline straight away, with its title, field labels and links, in the space the form will take. When the form loads it replaces the outline in place, so nothing on the page moves.

## API link responses include `id` and `createdAt`

Links returned by the API, when you create, get, update or list them, now include two more fields:

- `id`: the link's ID. It stays the same when you rename a link, so use it to tell links apart, for example when you poll for new links.
- `createdAt`: when the link was created, in ISO 8601 UTC. It's `null` for some older links.

The [API docs](/docs/api/get-link) list every field.

## Social previews for each page

When you share an ishortn.ink page on social media or in a chat app, the preview card now shows that page's own title instead of one generic image. This covers blog posts, the compare and solutions pages, the docs, pricing, features, the free tools and the changelog. Blog posts with a cover image still use their cover.

## Names on email sign-ups

Accounts created with an email and password and no name were saved with the name "null null". The dashboard showed it in the account menu, and emails opened with "Hi null". New sign-ups are no longer saved with that name. For accounts that already have it, the account menu shows the first part of your email address instead, and emails open with "Hi there". No screen or email shows "null" as a name any more.
