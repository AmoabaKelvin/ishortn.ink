---
date: 2026-11-25T18:00:00
version: 2.21.1
title: Sign-in returns you to the page you asked for, plus fixes for link previews and long fields
shortDesc: Signing in now takes you back to the page you were trying to open, legitimate cloud-storage links are no longer flagged, link previews show the right characters, and long names or notes get a clear message
category: fixed
---

A set of fixes for signing in, creating links and link previews.

## Sign-in takes you where you were going

If you open a dashboard page such as Pricing while signed out, signing in or signing up now brings you back to that page instead of the dashboard home.

## Fewer false phishing blocks on cloud storage links

Links to files on large storage and CDN hosts were sometimes refused because their hostnames have many subdomain levels. Links on Amazon S3 and other AWS hosts, Azure Blob Storage, Google Cloud Storage, Cloudflare R2, CloudFront and Rackspace CDN now go through. Subdomain levels are also counted below the registered domain, so addresses under two-part endings such as `.co.uk` aren't penalised for the ending itself. The other phishing checks still apply.

## Link previews in more languages

Titles and descriptions pulled from pages that aren't encoded as UTF-8, for example Arabic, Cyrillic or Western European pages using older encodings, now display correctly instead of as garbled text.

## Clear messages for long fields

A link name or note over 255 characters, an alias over 20 characters, or a tag over 50 characters now shows a message saying what to shorten instead of a generic server error. The API returns the same message for an alias that is too long.

## Friendlier message when AI alias suggestions are unavailable

If the suggestion service fails, you now see "Alias suggestions are unavailable right now. You can type your own alias." instead of a technical error.
