---
date: 2026-01-04T12:00:00
version: 1.5.0
title: Use Custom Domains Across Workspaces
shortDesc: Add the same custom domain to multiple workspaces for flexible branding
category: feature
---

Custom domains are now more flexible. You can add the same domain to your personal workspace and your team workspaces simultaneously—no more conflicts or workarounds needed.

## What's changed?

Previously, each custom domain could only belong to one workspace. If you added `links.yourcompany.com` to your personal workspace, you couldn't use it in a team workspace (or vice versa). This was frustrating if you wanted to use the same branded domain across multiple projects.

Now, domains work independently per workspace. Add your domain wherever you need it.

## How it works

When you add a custom domain that's already registered in another workspace:

1. **DNS stays the same** — Your existing DNS configuration continues to work
2. **Verification carries over** — You don't need to re-verify domain ownership
3. **Each workspace is independent** — Links created in one workspace don't affect another

## Example use case

Say you own `go.acme.com` and want to use it for:

- Personal projects in your personal workspace
- Marketing links in the Marketing team workspace
- Sales links in the Sales team workspace

Now you can add `go.acme.com` to all three workspaces. Each workspace manages its own links independently.

## Important: Link aliases are global

Link aliases remain globally unique per domain. If your Marketing team creates `go.acme.com/sale`, no other workspace can use that same alias on that domain. This prevents redirect conflicts and ensures every short link works reliably.

When creating links, you'll see an error if the alias is already taken—even if it was created in a different workspace.

## Removing a shared domain

When you remove a domain from a workspace, only that workspace loses access. Other workspaces using the same domain continue working normally. The domain is only fully removed from the system when the last workspace removes it.

## Who can use this?

Domain sharing is available to all users with custom domain access. In team workspaces, only the **team owner** can add or remove custom domains. Manage your domains at [/dashboard/domains](/dashboard/domains).
