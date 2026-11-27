---
title: "How to Create a WhatsApp Link with a Pre-Filled Message"
seoTitle: "WhatsApp Link with Message: How to Make One"
description: "Make a wa.me link that opens a chat with your message already typed in. The exact format, how to encode line breaks and emoji, a QR code for print, and how to track clicks."
date: "2026-12-01"
author: "Kelvin Amoaba"
tags: ["whatsapp", "small business", "qr code", "guide"]
published: true
---

If a customer has to save your number before they can message you, a lot of them won't bother. A click-to-chat link skips that step. One tap opens a WhatsApp chat with you, and if the link carries a pre-filled message, the first line is already written for them: "Hi, I'd like to order…"

This guide shows the exact link format WhatsApp documents, how to write and encode the message, how to test it, how to turn it into a QR code for menus and flyers, and how to count the people who tap it.

We make iShortn, so the tracking step uses it. Steps 1 to 4 work with any tool, or with no tool at all.

## The WhatsApp link format in one line

```
https://wa.me/<number>?text=<message>
```

That's the format in WhatsApp's own help article, [How to use click to chat](https://faq.whatsapp.com/5913398998672934). The number has to be your full international number, written as digits only. Leave out the `+`, any `00` at the start, spaces, dashes and brackets, and drop the leading 0 you'd use when dialling inside your own country.

| Country | How you'd write it locally | What goes in the link |
|---|---|---|
| UK | 07700 900123 | 447700900123 |
| Ghana | 024 412 3456 | 233244123456 |
| US | (555) 123-4567 | 15551234567 |

So a Ghanaian shop's link with a short message looks like this:

```
https://wa.me/233244123456?text=Hi%2C%20I'd%20like%20to%20order
```

If you leave the number out (`https://wa.me/?text=...`), the link becomes a share link. The person picks who to send the message to, which is handy for "send this to a friend" offers.

You'll also see older guides use `api.whatsapp.com/send?phone=...`. WhatsApp's click-to-chat article documents `wa.me`, so use that.

## Step 1: Write a message people will actually send

The pre-filled message works best when it's short and says what the chat is about. Some examples:

- Restaurant: "Hi, I'd like to book a table for __ people on __ at __."
- Shop: "Hi, is the blue linen dress still available in size __?"
- Salon: "Hi, I'd like a hair appointment this week. What times do you have?"
- Freelancer: "Hi, I'd like a quote for a logo. My budget is about __."

The person sees the text in the message box and can change it before sending. Blanks like "for __ people" are fine, and they get you the details you'd otherwise have to ask for.

Use a different message for each place you share the link. If the menu link says "Hi, I'm at table __" and the Instagram link says "Hi, I saw your post about…", you'll know where each chat came from without asking.

## Step 2: Encode the message

Links can't contain raw spaces or line breaks, so the message has to be URL-encoded. The characters that matter most:

| Character | Encoded |
|---|---|
| space | `%20` |
| line break | `%0A` |
| `&` | `%26` |
| `?` | `%3F` |
| `#` | `%23` |
| emoji 🍗 | `%F0%9F%8D%97` |

Here's a three-line order message:

```
Hi! I would like to order:
2 jollof rice & chicken 🍗
Pickup at 6pm?
```

And the same message encoded in a link:

```
https://wa.me/233244123456?text=Hi!%20I%20would%20like%20to%20order%3A%0A2%20jollof%20rice%20%26%20chicken%20%F0%9F%8D%97%0APickup%20at%206pm%3F
```

The `&` and `#` are the ones that break things. Left unencoded, everything after them is cut off, so the customer opens a chat whose message stops at "2 jollof rice".

You don't have to do this by hand. Our [free WhatsApp link generator](https://ishortn.ink/whatsapp-link-generator?utm_source=blog&utm_medium=content&utm_campaign=whatsapp-link-with-message) encodes the message as you type, adds the country code to your number, and drops the leading 0. It runs in your browser and doesn't need an account.

## Step 3: Test it on a phone and a computer

Before you print or post anything, send the link to yourself and open it:

1. Tap it on an iPhone and on an Android phone if you can borrow one. The chat should open with your message in the text box.
2. Open it on a computer. The wa.me page hands you over to WhatsApp Web or the desktop app.
3. Check that the number is right, the line breaks sit where you put them, and the emoji came through.

**If it says the number isn't on WhatsApp**, the country code is usually missing or the leading 0 is still there. Check the digits against the table above. Argentine mobile numbers usually need a 9 after the country code (54 9 …). And the number has to be registered on WhatsApp, which matters if your shop uses a landline for calls and a separate mobile for WhatsApp.

## Step 4: Make a QR code for print

A QR code turns the link into something people can scan from a menu, a table tent, a flyer, a shop window or the side of a delivery bag. The generator above makes one alongside the link.

A few things decide whether it scans:

- **Size.** At least about 2 cm wide for anything held in the hand. For a sign on a wall, make the code about a tenth of the distance people scan from, so a code read from 1 metre away should be 10 cm wide.
- **Message length.** Every character of the message goes into the code. A long message makes a dense pattern with tiny squares that's hard to scan from across a room. Keep the message short, or shorten the link first (Step 5).
- **File type.** Send SVG to a print shop, because it stays sharp at any size. Use PNG for social posts and documents.

People should scan it with their phone's camera app. WhatsApp's own help centre says [the WhatsApp camera can only scan official WhatsApp QR codes](https://faq.whatsapp.com/282715776424644), so a code from any other generator won't open from inside WhatsApp. That's the usual reason behind "my WhatsApp QR code won't scan". Add a line like "Scan with your camera to chat with us" next to the code.

If you use the WhatsApp Business app, it already has a short link and a QR code in the Tools tab under Short link, with one default message you can edit. That's fine for a single general-purpose code. A generator is more useful when you want a different message for each placement, or a vector file for print.

## Step 5: Track clicks and keep the option to change the number

WhatsApp doesn't tell you how many people tapped your link or scanned your code. You see the chats that arrive, but not the people who opened the chat and left without sending.

Shortening the wa.me link with iShortn adds that count. You get clicks by day, country, device and referrer. The free plan shows the last 7 days of analytics and records up to 1,000 tracked clicks a month. More on reading those numbers in [how to track link clicks](/blog/how-to-track-link-clicks).

The bigger reason to shorten before you print is that a short link can be edited. A raw wa.me code has your number and message built into the pattern. If a staff member leaves with the shop phone, or you change numbers, every printed menu still opens the old chat. If the code holds a short link, you change where it points and the printed code keeps working. That's how a dynamic QR code works, and it's why [QR codes stop working](/blog/qr-code-stopped-working) when the link inside them dies.

On iShortn's free plan you get 30 links a month and 5 dynamic QR codes that don't expire. On Pro ($8 a month) you can use your own domain, so the link reads `chat.yourshop.com/order` instead of a long wa.me address. Restaurants can see how this fits with menus and table cards in [QR codes for restaurants and bars](/solutions/restaurants) and our guide to a [QR code for a restaurant menu](/blog/qr-code-for-restaurant-menu).

Use the link for people who choose to contact you: customers on your menu, followers in your bio, visitors on your website. Don't use it to message lists of strangers. WhatsApp's [Business Messaging Policy](https://business.whatsapp.com/policy) requires opt-in, and so do our [terms](/terms).

## Quick answers

**Does a WhatsApp link work without WhatsApp Business?** Yes. Click-to-chat links work with personal WhatsApp accounts and WhatsApp Business accounts.

**Can I put a WhatsApp link in my Instagram bio?** Yes. A short link is easier to read than a long wa.me address. If you want WhatsApp alongside your shop and booking links, put them on a bio page; see [how to add multiple links to your Instagram bio](/blog/how-to-add-multiple-links-to-instagram-bio).

**Can I change the message after I've shared the link?** Not on a raw wa.me link, because the message is part of the address. If you shared a short link, you can point it at a new wa.me link with a new message.

**Is it safe to share my WhatsApp link publicly?** The link shows your number to anyone who opens it, so use a business number, not your personal one.

## Make your link

Write one short message, run it through the generator, test it on your own phone, and print the code big enough to scan. If the code is going on something you'll print a lot of, shorten the link first so you can change the number later without reprinting.

Small businesses can see more ways to use links and QR codes on [iShortn for small businesses](/solutions/small-business).

**[Make your WhatsApp link and QR code, free →](https://ishortn.ink/whatsapp-link-generator?utm_source=blog&utm_medium=content&utm_campaign=whatsapp-link-with-message)**

The generator is free, runs in your browser and needs no account. To shorten and track the link, [create a free iShortn account](https://ishortn.ink/auth/sign-up?utm_source=blog&utm_medium=content&utm_campaign=whatsapp-link-with-message).
