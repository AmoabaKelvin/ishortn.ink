---
date: 2026-11-27T20:00:00
version: 2.24.0
title: Bulk QR codes, an MCP server for AI assistants and WhatsApp order buttons
shortDesc: Create QR codes for a whole CSV import and download them as a ZIP or print-ready PDF, let AI assistants manage your links, add a WhatsApp order button to bio pages, and set up app download and Amazon storefront rules in one click
category: new
---

## QR codes for a whole CSV import

When you import links from a CSV (**Upload CSV** in the links list menu), tick **Also create QR codes** and pick a QR style. Each new link gets a QR code for its short URL. When the import finishes, **Download ZIP** gives you an SVG and a PNG of every code, named after the link's alias.

You can also select codes on the **QR Codes** page and download them as one ZIP.

Bulk QR codes and ZIP downloads are on Pro (up to 100 codes at a time) and Ultra (no limit).

## Print-ready PDF for any QR code

Choose **Download PDF for print** from a QR code's menu to get a PDF at the exact size you need: 2, 3 or 5 cm, or any size from 1 to 50 cm. You can add a "Scan me" frame with your own label. The code is drawn as vector shapes, so it prints sharp at any size. This is available on every plan.

## Manage links from your AI assistant

iShortn now has a remote MCP server at `https://ishortn.ink/mcp`. Connect it to Claude Code, Claude Desktop, Cursor, Codex or another MCP client with one of your API keys, then ask in plain language: create, edit and delete links, list them, check a link's analytics, or get a QR code for a link. Links created this way count toward your monthly link limit, like links you create in the dashboard.

The MCP server uses the API, so it needs a Pro or Ultra plan. The [MCP server guide](/docs/integrations/mcp) has setup steps for each client.

## WhatsApp order button for bio pages

Add a **WhatsApp** block to your bio page with your phone number, an optional pre-filled message and a button label. Visitors tap it to open a WhatsApp chat with your message already typed. Clicks are tracked like any other link block, and on the Free plan the block counts toward the 3 link blocks per bio page.

## Targeting rule presets

Two shortcuts in the **Targeting Rules** section of a link or QR code:

- **App download link**: enter your App Store, Google Play and website addresses. iPhone and iPad visitors go to the App Store, Android visitors to Google Play, and everyone else to your website.
- **Amazon storefronts**: when the link points to an Amazon product page, iShortn suggests rules that send visitors to the same product on their local Amazon store (US, UK, Germany, Canada, France, Italy, Spain, India and Australia). Add them with one click, then edit or remove any before you save.

Both use your plan's targeting rules: up to 3 per link on Pro, unlimited on Ultra.

## Redesigned emails

The welcome email and the weekly summary have a new, cleaner design that supports dark mode. The weekly summary's subject line now shows your click count and how it changed from the week before.
