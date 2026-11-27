---
date: 2026-11-20T12:00:00
version: 2.8.0
title: See your event usage, bigger free bio pages, and ongoing link safety checks
shortDesc: Free plans now show event usage and when tracking pauses, bio link blocks no longer use your monthly links, and live links are re-checked for phishing
category: improved
---

Four changes that make your plan limits clearer and shared links safer.

## Know when analytics tracking pauses

The Free plan includes 1,000 tracked clicks a month, and both link clicks and bio-page views count toward it. Your sidebar now shows an **event meter** on the Free plan too, not just on Pro.

If you go over the limit, your links keep redirecting as normal, but new visits aren't recorded until the month resets. When that happens, link analytics and your bio page's Analytics tab show a banner with the date tracking paused, how many visits went through without being recorded, and when it resets. The pricing FAQ now spells out what counts as an event on each plan.

## Bio link blocks no longer use your monthly links

On the Free plan, link blocks on your bio page no longer count toward your 30 links a month. A free bio page can hold up to 3 link blocks. On Pro and Ultra, bio links count toward your monthly link allowance as before, with no block cap.

## Ongoing link safety checks

Links were already checked for phishing when created. They are now also checked when you change a link's destination, and every live link is re-checked against public phishing feeds and Google Safe Browsing every few hours. Links pointing to confirmed phishing pages are blocked automatically. This protects the people who click your links and keeps our shared domains trusted by browsers and security filters.

## API links follow the same rules as the dashboard

Links created with `POST /api/v1/links` now count toward your monthly link allowance, just like links created in the dashboard. Once the limit is reached, the API returns `403` with the same message the dashboard shows, until the month resets. Custom aliases are validated the same way too: on the Free plan they need at least 6 characters, and an alias that matches an existing one in a different case is rejected as already taken (`400`).
