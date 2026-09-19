# Marketing + auth design language

Applies to `src/app/(landing)/**` and `src/app/(auth)/**` (scoped by `data-theme="site"`). The dashboard is untouched.

## The look in one paragraph

A quiet, monochrome blueprint. A light gray canvas carries white cards. Hairlines frame the page: two vertical lines at the container edges, a full-bleed horizontal line between every section, and a small `+` registration mark where they cross. Headlines are big, heavy, tightly tracked geometric sans. Everything else is calm gray body text. Color never comes from the chrome: it only shows up inside product mockups, third-party logos, and status dots. Cards hold miniature, hand-built pieces of product UI that bleed off the card's bottom or right edge.

## Tokens

Tailwind 3.4 project. Use utility classes, never inline `style` (except truly dynamic values). Never use `dark:` variants, shadcn `ui/*` components, or `hsl(var(--…))` app tokens here: this theme is light-only and the app's dark class must not leak in.

| Thing | Value |
| --- | --- |
| Canvas | `bg-neutral-100` (set by `[data-theme="site"]`) |
| Surface | `bg-white` |
| Ink (headings, primary button) | `neutral-900` |
| Body text | `neutral-600` (AA on canvas). Fine print `neutral-500` only on white |
| Hairlines / dividers | `border-neutral-950/[0.07]`, never a solid gray |
| Wells, chips, soft fills | `bg-neutral-950/[0.06]` or `bg-neutral-100` on white |
| Accent color | none. Emerald/amber/violet/etc. only inside product mockups (event chips, chart bars, status dots) |
| Display font | Google Sans → `font-title` (use the exported `titleClass`/`h1Class`/`h2Class`/`h3Class`) |
| Body font | Inter (inherited from the theme wrapper) |
| Mono | `font-mono` for step numbers, short URLs, status pill |
| Card | `cardClass` = `rounded-2xl bg-white shadow-site-card` (ring is inside the shadow; do not add `border`) |
| Panel (hero, CTA) | `panelClass` = `rounded-3xl …` |
| Nested radius | concentric: card `rounded-2xl` (16) with `p-2` → inner `rounded-lg`; mock UI inside cards `rounded-xl`; inputs/buttons `rounded-[10px]` |
| Buttons | `ButtonLink` / `buttonClass`. `primary` near-black with inner highlight, `secondary` white with hairline shadow, `soft` gray fill. Trailing chevron by default. Never pill-shaped |
| Column gap | `gap-4` between cards in every grid (tight gutters). Split layouts `gap-x-8` |
| Section padding | handled by `<Section>`; override only for slim bands (`className="py-10"`) |

All primitives live in `src/app/(landing)/_components/site-primitives.tsx`: `Section`, `SectionHeading`, `Eyebrow`, `ButtonLink`, `buttonClass`, `cardClass`, `panelClass`, `wellClass`, `StepChip`, `IconPlate`, `Wordmark`, `Logo`, type classes. CSS helpers in `src/styles/site.css`: `.site-plus`, `.site-tiles` (CTA background), `.site-dots` (auth background), `.site-marquee`. **Use these. Do not re-implement them, do not edit them** (ask the lead if something is missing).

## Page anatomy

Every band is a `<Section>`. It draws the top hairline, the vertical container lines (xl and up), and the `+` marks. Never add your own max-width wrapper or horizontal page padding. The container is 1240px with `xl:px-16`.

Section recipe: `Eyebrow` pill → `h2` → one-sentence subtitle → (optional) button pair → `mt-14` → content grid. Use `SectionHeading`.

- Eyebrow: a 16px **filled** Tabler icon + 1–3 words.
- Centered headings for hero-adjacent, symmetrical grids, pricing, testimonials, FAQ, CTA. Left-aligned for split layouts.
- Buttons: the page has ONE primary action ("Get started" → `/auth/sign-up`). Mid-page sections use `secondary`/`soft` variants or no buttons. Header button is the small primary.

### Card recipes

- **Step card** (3-up): `StepChip` "01" → `h3Class` title → body → product mock filling the lower half, clipped by `overflow-hidden` so it bleeds off the bottom/right edge.
- **Bento feature card** (2×2): title + body at top (`p-6 sm:p-8`), mock UI below bleeding off the bottom. "Stacked paper": a second card edge peeking 8px above the mock (`absolute inset-x-4 -top-2 h-4 rounded-t-xl bg-white shadow-site-card`).
- **Icon tile** (4×2): `cardClass` square, `IconPlate` with a 24px filled Tabler icon, label `text-sm font-medium` centered.
- **Mock UI** inside cards: built from HTML, not images. White, `rounded-xl shadow-site-card`, tiny type (`text-xs`/`text-[0.8125rem]` is fine _inside mockups only_), `aria-hidden="true"` on the whole mock, segmented controls = `bg-neutral-100 p-0.5 rounded-lg` with a white raised active item. Use realistic iShortn data (`ishortn.ink/launch`, click counts, countries).
- **Quote card**: quote in `font-title text-2xl font-semibold tracking-tight`, attribution bottom-aligned (`flex flex-col justify-between`), hanging quotes.
- **FAQ**: no cards. Rows split by hairlines, question `font-title text-lg font-semibold`, `+` icon right that rotates to `×`. Native `<details>`.
- **Logo/trust band**: slim `<Section className="py-10">`, muted two-line label left, content right.

## Rules that bite (from the ui.sh design guidelines)

- Body copy is `text-base` on mobile, may drop to `sm:text-sm`. Never `text-xs` outside mockups.
- Headings: no `font-bold` utilities and no `leading-*` beyond what the exported classes set. `text-balance` on headings, `text-pretty` on paragraphs. Constrain text with `max-w-[..ch]` on the element, never on the heading-group wrapper.
- Shadows never pair with a solid border. Use `shadow-site-card`/`shadow-site-btn` (ring baked in) or `ring-1 ring-neutral-950/5`.
- Icons: only `@tabler/icons-react`. Never hand-write SVG icons (product illustrations/charts in mockups are fine). `size-4` next to `text-sm`, `size-5` nav, `size-6` in `IconPlate`. `shrink-0` inside flex. Buttons/badges with an icon use asymmetric padding (already handled by the primitives).
- `hover:` only on interactive elements. No `transition-*` on color/background hovers: transitions only for things that move.
- Feature lists use `<dl>/<dt>/<dd>`. Do not add `role="list"` to `<ul>` (project lint forbids redundant roles).
- Avatars/photos: `outline outline-1 -outline-offset-1 outline-black/5`, never `border`.
- Pricing: emphasize the featured plan with the primary button + a "Popular" badge, not a different card background. Buttons bottom-aligned (`flex flex-col justify-between`).
- Logo link: `<Link href="/" aria-label="Homepage">`.
- No emojis. Flags in mockups: use text country names or Tabler icons.
- Tailwind 3.4 caveats: no `h-lh`, no `rounded-(--x)`, no `outline-1` alone (write `outline outline-1`). `size-*`, `text-balance`, `text-pretty` are fine.
- Respect `prefers-reduced-motion` (`motion-reduce:` or CSS media query) on anything animated. `framer-motion` is installed; prefer CSS.

## Voice

Plain, confident, benefit-first. Short sentences. No whimsy ("lovely", "quietly", "coat of paint" are retired), no exclamation marks except the one "…and so much more!" heading. Subtitles are one sentence and end with a period. Headings have no period. Button labels are 1–3 words, sentence case. Never invent numbers, customers, ratings, or awards: only reuse facts that already exist in the codebase (`PLAN_FEATURES`, `landingPageCopy`, existing testimonials, changelog).

Agreed copy (use verbatim so the page reads as one voice):

| Section | Eyebrow | Headline | Subtitle |
| --- | --- | --- | --- |
| Hero | pill link: "See what's new" → `/changelog` | The better way to share your links | Short links, QR codes, and link-in-bio pages with analytics built in. Made for creators, marketers, and teams who want to know what works. |
| How it works | How it works | With us, link management is easy | Three steps from a long URL to a link you can track. |
| Benefits | Benefits | Your all-purpose link platform | Everything you need to shorten, brand, and measure your links. Free to start. |
| Tiles | — | …and so much more! | — |
| QR | QR codes | QR codes that match your brand | (left-aligned panel, adapt existing copy) |
| Analytics preview | Analytics | Know who clicked, where, and when | Every short link comes with its own dashboard. No extra setup. |
| Testimonials | Testimonials | Don't just take our word for it | Our users are our best ambassadors. See why they chose iShortn. |
| Pricing | Pricing | Simple pricing, no surprises | Start free. Upgrade when you're ready. Cancel anytime. |
| FAQ | FAQ | Frequently asked questions | These are the questions we hear most. |
| CTA | — | Smarter, simpler link sharing | — (buttons: "Get started", "View pricing"; reassurance row: Free forever plan · No credit card required · Cancel anytime) |
| Sign in | — | Wordmark, then "Welcome back! Sign in to continue" | — |
| Sign up | — | Wordmark, then "Create your account to start shortening" | — |

Subpage heroes follow the same pattern: `Eyebrow` + `h1Class` headline + one-sentence `leadClass` subtitle, centered, inside a `<Section>`.
