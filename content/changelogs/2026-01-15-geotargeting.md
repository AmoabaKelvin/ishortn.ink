---
date: 2026-01-15T12:00:00
version: 1.8.0
title: Geotargeting
shortDesc: Redirect or block visitors based on their country or continent
category: feature
---

Your links can now make smarter decisions. With geotargeting, you can automatically redirect visitors to different destinations—or block access entirely—based on where they're located.

## What's new?

When you create or edit a link, you'll find a new "Geotargeting Rules" section. Here you can set up rules that determine what happens when someone clicks your link based on their geographic location.

### Rule types

- **Country-based** — Target specific countries using ISO country codes (e.g., US, GB, DE)
- **Continent-based** — Target entire regions like Europe, Asia, North America, etc.

### Actions

For each rule, you can choose one of two actions:

- **Redirect** — Send visitors to a different URL based on their location
- **Block** — Show a "blocked" page with an optional custom message

### Conditions

Rules support two conditions:

- **Is in** — Rule matches when the visitor IS from the selected locations
- **Is not in** — Rule matches when the visitor is NOT from the selected locations

## How to use it

1. **Create or edit a link** — Go to your dashboard and create a new link or edit an existing one
2. **Expand Geotargeting Rules** — Click the section to reveal the rule builder
3. **Add a rule** — Click "Add Rule" and configure your targeting
4. **Set the type** — Choose between country or continent targeting
5. **Select locations** — Pick the countries or continents to target
6. **Choose an action** — Redirect to a URL or block with a message
7. **Save** — Your geotargeting rules are now active

## Example use cases

### Regional landing pages

Send US visitors to your US pricing page and EU visitors to your EU pricing page:

- Rule 1: Country is in `US` → Redirect to `yoursite.com/us/pricing`
- Rule 2: Continent is in `Europe` → Redirect to `yoursite.com/eu/pricing`
- Default: All other visitors go to your main pricing page

### Content restrictions

Block access from specific regions due to licensing or compliance:

- Rule: Country is in `CN, RU, IR` → Block with message "This content is not available in your region"

### Localized campaigns

Direct visitors to language-specific content:

- Rule 1: Country is in `DE, AT, CH` → Redirect to German landing page
- Rule 2: Country is in `FR, BE, CA` → Redirect to French landing page
- Rule 3: Country is in `ES, MX, AR` → Redirect to Spanish landing page

## Rule priority

Rules are evaluated in order from top to bottom. The first matching rule wins. If no rules match, visitors are sent to the default destination URL.

## Analytics

Track how your geo rules perform directly in your link analytics. You'll see:

- **Default destination** — Clicks that went to your standard URL
- **Redirected** — Clicks that matched a redirect rule
- **Blocked** — Clicks that matched a block rule

Switch to the "Geo" view in your analytics chart to see a visual breakdown of how traffic is being routed.

## Plan limits

Geotargeting is available on paid plans with the following limits:

- **Pro** — Up to 3 rules per link
- **Ultra** — Unlimited rules per link

## Who can use this?

Geotargeting is available to **Pro** and **Ultra** subscribers. Start targeting your audience by location when [creating a new link](/dashboard/link/new) or editing an existing one.
