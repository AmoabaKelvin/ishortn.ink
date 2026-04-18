---
date: 2026-04-17T12:00:00
version: 2.3.0
title: Verified Clicks
shortDesc: See how many of your clicks came from real visitors, not automated traffic
category: new
---

Not every click on a short link is a person. Link scanners, security tools, preview crawlers, and other automated systems all follow links — and they all count toward your total. Verified Clicks separates the real visitors from the noise, so when you report "500 clicks" you can back it up with "and 320 of them were real people who actually opened the page."

## What's new?

### A "Verified Visits" number in your analytics

Open the analytics page for any link with Verified Clicks turned on and you'll see a new card alongside Total Visits: **Verified Visits**. It shows how many of your clicks came from a real visitor opening the page — the rest is automated traffic, prefetch requests, and other noise you probably don't want to count.

The gap between the two numbers is itself useful. A campaign sitting at 90% verified is healthy engagement. A campaign at 20% verified is telling you something about where those clicks are coming from.

### A simple toggle per link

When you create or edit a link, you'll find a new **Verified Clicks** section. Flip the switch and the feature is active immediately — no extra setup, no snippet to paste, no change to the short URL.

You can turn it on for new links, or go back and enable it on links you've already shared. Existing click history stays intact; the verified count starts tracking from the moment you turn it on.

### Works across your links — including password-protected ones

Verified Clicks works with all your link types:

- **Regular short links** — the standard redirect flow
- **Cloaked links** — where your branded URL stays visible
- **Password-protected links** — the verified count picks up after the visitor unlocks the link

## Why it matters

- **Trustworthy reporting** — Share numbers with clients, teams, or stakeholders knowing they reflect real engagement, not inflated crawler traffic
- **Campaign confidence** — Spot when a link is getting a lot of clicks but little actual attention
- **Cleaner comparisons** — When two campaigns have the same total clicks but very different verified counts, you know which one actually connected with people

## How it works

When someone clicks your link, we quietly check whether the click came from a real browser actually loading the page. If it did, we count it as verified. If it was an automated system that never really opened the page, it still shows up in your total count but doesn't count as verified.

You don't see anything different as the link owner — the short URL still works exactly the same way, and visitors are taken to the destination as usual.

## Who can use this?

Verified Clicks is available on the **Pro** and **Ultra** plans. Enable it on any link from the [new link page](/dashboard/link/new) or by editing an existing link from your dashboard.
