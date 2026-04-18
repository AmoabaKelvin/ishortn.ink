# iShortn Warm / Humanist Design System

This document describes the warm, humanist design system that powers the iShortn marketing surfaces (`/`, `/features`, `/pricing`, `/blog`, `/compare/[slug]`, `/changelog`, `/privacy`, `/terms`) and the Clerk-powered auth flow (`/auth/sign-in`, `/auth/sign-up`). The signed-in dashboard (`(main)/dashboard/**`) uses a different, unrelated theme; do not extend the warm theme into it.

All tokens, utility classes, and component-scoped styles live behind the `[data-theme="warm"]` selector in `src/styles/globals.css`. Do not touch the warm theme outside that block.

---

## 1. Overview and Principles

- Warm humanist, editorial-meets-technical. Think a small magazine that happens to ship software.
- Fraunces (variable serif) for display. Inter for UI. Terracotta accent on an ivory paper palette.
- Calm, not loud. Soft borders, rounded-but-not-cartoonish radii, generous whitespace, true italics for emphasis.
- Scoped. The theme is activated by a parent element with `data-theme="warm"`; removing that attribute restores the host app's default palette. It never bleeds into the signed-in dashboard.

Files that most often need edits:

- `src/styles/globals.css` — canonical tokens and utility classes
- `src/lib/fonts.ts` — font loading
- `src/app/(landing)/_components/*` — landing sections
- `src/app/(landing)/_components/warm-primitives.tsx` — `Icon`, `Logo`, `Wordmark`
- `src/app/(landing)/changelog/**` — changelog page + components
- `src/app/(auth)/auth/_shared/clerk-appearance.ts` — Clerk theming object

---

## 2. Theming Mechanism

The theme is applied by wrapping a subtree with:

```tsx
<div data-theme="warm" data-accent="terracotta">
  {children}
</div>
```

- `data-theme="warm"` is required. Every warm-theme CSS selector in `globals.css` is prefixed with `[data-theme="warm"]`.
- `data-accent="terracotta" | "sage" | "plum"` is optional and swaps `--warm-accent` / `--warm-accent-deep`. `terracotta` is the default; omitting the attribute still gives terracotta because that's the fallback value inside the base block.

Applied in two places:

- `src/app/(landing)/layout.tsx`
  ```tsx
  <div data-theme="warm" data-accent="terracotta" className="min-h-screen">
    {children}
  </div>
  ```
- `src/app/(auth)/auth/layout.tsx`
  ```tsx
  <div
    data-theme="warm"
    data-accent="terracotta"
    style={{
      minHeight: "100vh",
      background: "var(--warm-bg)",
      color: "var(--warm-ink)",
      display: "grid",
      gridTemplateRows: "auto 1fr auto",
    }}
  >
    ...
  </div>
  ```

The root `src/app/layout.tsx` only injects the font CSS variables on `<body>`. It does not apply `data-theme`. That's deliberate — opting in per route group keeps the dashboard untouched.

### Opting in elsewhere

To use the theme on a new route group, wrap the top of that layout with a `<div data-theme="warm">`. Do not move the attribute to `<html>` or `<body>` — it would leak into every signed-in page.

---

## 3. Color Tokens

Every token is declared once inside `[data-theme="warm"]` in `src/styles/globals.css`. Reference by CSS variable (`var(--warm-...)`) from any descendant — never hardcode these hex values in component code.

| Token | Hex | Intent | Typical use |
| --- | --- | --- | --- |
| `--warm-bg` | `#F7F1E8` | Ivory page background | Page `<main>` background, between sections |
| `--warm-paper` | `#FFFCF5` | Lightest paper surface | Cards, inputs, section-paper, eyebrows |
| `--warm-paper-2` | `#FCF5E8` | Secondary paper | Browser-chrome strip, table header rows, code blocks |
| `--warm-ink` | `#2B1F17` | Primary text / ink surfaces | Body text, `.warm-btn-primary`, dark sections, CTA block |
| `--warm-ink-soft` | `#4A3A2E` | Secondary text, ghost button label, primary-hover | Paragraph text on paper, nav links |
| `--warm-mute` | `#8A7868` | Muted captions, meta | Timestamps, form hints, eyebrow text |
| `--warm-mute-soft` | `#B5A696` | Very muted (placeholder, divider glyphs) | `input::placeholder`, `.cl-divider` dots |
| `--warm-line` | `#E6D9C5` | Default 1px border | Cards, buttons-ghost, inputs |
| `--warm-line-soft` | `#EFE6D4` | Hairline divider | Between rows, section separators |
| `--warm-terracotta` | `#C85C3B` | Brand accent (default) | Links, `.warm-btn-accent`, wordmark period |
| `--warm-terracotta-deep` | `#A84724` | Accent pressed / hover | `.warm-btn-accent:hover`, CTA link hover |
| `--warm-sage` | `#8BA881` | Positive / freshness cue | `.warm-eyebrow-dot`, status dots, delta badges |
| `--warm-sage-deep` | `#6E8A66` | Sage text / `.cl-tag-new` foreground | Success text, "Latest" label |
| `--warm-cream` | `#FCECD4` | Warm accent surface | `.warm-section-cream`, QR section bg, `.cl-tag-improved` |
| `--warm-butter` | `#F5E1B0` | Optional warm surface | Currently reserved / palette extension |
| `--warm-plum` | `#6B4B5E` | Secondary accent option | `.cl-tag-shipped` foreground, `data-accent="plum"` |
| `--warm-accent` | `var(--warm-terracotta)` | Resolved accent (theme-aware) | Do not read the raw terracotta var — read this |
| `--warm-accent-deep` | `var(--warm-terracotta-deep)` | Resolved pressed accent | As above |
| `--warm-accent-ink` | `#ffffff` | Text color that pairs with accent fills | `.warm-btn-accent` label |

The canonical block, verbatim:

```css
[data-theme="warm"] {
  --warm-bg: #F7F1E8;
  --warm-paper: #FFFCF5;
  --warm-paper-2: #FCF5E8;
  --warm-ink: #2B1F17;
  --warm-ink-soft: #4A3A2E;
  --warm-mute: #8A7868;
  --warm-mute-soft: #B5A696;
  --warm-line: #E6D9C5;
  --warm-line-soft: #EFE6D4;

  --warm-terracotta: #C85C3B;
  --warm-terracotta-deep: #A84724;
  --warm-sage: #8BA881;
  --warm-sage-deep: #6E8A66;
  --warm-cream: #FCECD4;
  --warm-butter: #F5E1B0;
  --warm-plum: #6B4B5E;

  --warm-accent: var(--warm-terracotta);
  --warm-accent-deep: var(--warm-terracotta-deep);
  --warm-accent-ink: #ffffff;

  --warm-radius-sm: 10px;
  --warm-radius-md: 16px;
  --warm-radius-lg: 24px;
  --warm-radius-xl: 32px;

  background: var(--warm-bg);
  color: var(--warm-ink);
  font-family: var(--font-warm-ui), -apple-system, BlinkMacSystemFont, system-ui,
    sans-serif;
  line-height: 1.5;
  font-feature-settings: "ss01";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

Accent modifiers:

```css
[data-theme="warm"][data-accent="sage"] {
  --warm-accent: var(--warm-sage);
  --warm-accent-deep: var(--warm-sage-deep);
}
[data-theme="warm"][data-accent="plum"] {
  --warm-accent: var(--warm-plum);
  --warm-accent-deep: #4F3545;
}
```

---

## 4. Typography

Two families, both loaded via `next/font` in `src/lib/fonts.ts` and injected on `<body>` in `src/app/layout.tsx`.

### Fraunces — display

```ts
export const fontWarmDisplay = Fraunces({
  subsets: ["latin"],
  variable: "--font-warm-display",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
});
```

- Loaded as a variable font. `next/font` does not allow `weight` together with `axes`, so we rely on Fraunces's full variable weight range instead of enumerating weights. Do not add a `weight` array here; it will break the build.
- Exposed as `var(--font-warm-display)`.
- Display headlines should use `.warm-display`, which sets Fraunces, `font-weight: 400`, tight tracking, and Fraunces's optical and softness axes:
  ```css
  [data-theme="warm"] .warm-display {
    font-family: var(--font-warm-display), Georgia, "Times New Roman", serif;
    font-weight: 400;
    letter-spacing: -0.02em;
    line-height: 0.98;
    font-variation-settings: "opsz" 144, "SOFT" 50;
  }
  ```
- For italic emphasis, use real `<em>` or `font-style: italic`. Fraunces has a true italic — do not fake it with `transform: skew`.

### Inter — UI

```ts
export const fontWarmUi = Inter({
  subsets: ["latin"],
  variable: "--font-warm-ui",
  weight: ["300", "400", "500", "600"],
});
```

- Exposed as `var(--font-warm-ui)`.
- The body font for `[data-theme="warm"]` — already set on the theme root. Children inherit it automatically.

### Fluid sizes

Hero and section headlines use `clamp()` so they scale smoothly between mobile and large desktop. Common ratios you'll find in the codebase:

| Component | `fontSize` |
| --- | --- |
| `Hero` h1 | `clamp(54px, 9vw, 104px)` |
| `DashboardPreview`, `Features`, `Pricing`, `Testimonials` h2 | `clamp(44px, 7vw, 80px)` |
| `QRSection` h2 | `clamp(40px, 6.4vw, 72px)` |
| `Faq` h2 / feature / privacy / compare sub-h2 | `clamp(40px, 6vw, 60px)` / `clamp(36px, 5vw, 48px)` |
| `CTA` h2 | `clamp(72px, 12vw, 140px)` |
| `ChangelogHero` / blog / compare / privacy h1 | `clamp(54px, 9vw, 84px)` or `clamp(54px, 9vw, 104px)` |

### Fraunces italic date styling (changelog entries)

```css
[data-theme="warm"] .cl-entry-date {
  font-family: var(--font-warm-display);
  font-style: italic;
  font-size: 14px;
  color: var(--warm-mute);
  font-variation-settings: "opsz" 14;
}
```

The lower `opsz` value (14) makes Fraunces switch to its text-optimized italic for small sizes.

---

## 5. Spacing and Radii

Radius scale (`[data-theme="warm"]`):

| Token | Value |
| --- | --- |
| `--warm-radius-sm` | `10px` |
| `--warm-radius-md` | `16px` |
| `--warm-radius-lg` | `24px` |
| `--warm-radius-xl` | `32px` |

Container:

```css
[data-theme="warm"] .warm-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}
@media (min-width: 768px) {
  [data-theme="warm"] .warm-container {
    padding: 0 48px;
  }
}
```

Section padding:

```css
[data-theme="warm"] .warm-section {
  padding: 96px 0;
  position: relative;
}
@media (min-width: 768px) {
  [data-theme="warm"] .warm-section {
    padding: 120px 0;
  }
}
```

Card / pill radii seen in components: 14, 18, 20, 22, 24, 32 px. Prefer the `--warm-radius-*` tokens for new code; the one-off values exist in legacy inline styles.

---

## 6. Utility Classes

All defined in `src/styles/globals.css` under `[data-theme="warm"]`. Treat these as the public API — build new sections out of them before reaching for inline styles.

### Layout

- `.warm-container` — max-width 1280px, centered, responsive side padding (24 → 48).
- `.warm-section` — 96px / 120px vertical padding, `position: relative`.
- `.warm-section-paper` — `background: var(--warm-paper)`.
- `.warm-section-cream` — `background: var(--warm-cream)`.
- `.warm-section-ink` — `background: var(--warm-ink); color: var(--warm-paper);`.

### Surfaces

- `.warm-card`
  ```css
  background: var(--warm-paper);
  border: 1px solid var(--warm-line);
  border-radius: var(--warm-radius-lg); /* 24 */
  ```

### Eyebrows (small label pill used above every h1/h2)

- `.warm-eyebrow` — inline-flex pill, `6px 14px` padding, paper background, `--warm-line` border, 12px mute text, 10px gap.
- `.warm-eyebrow-dot` — 6×6 sage circle. Put inside a `.warm-eyebrow` as the leading indicator.

```tsx
<div className="warm-eyebrow" style={{ marginBottom: 20 }}>
  <span className="warm-eyebrow-dot" />
  Loved by 40,000+ creators
</div>
```

Eyebrows are frequently overridden inline to swap the `background` (see CTA on dark, QR section on cream).

### Buttons

Base:

```css
.warm-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 13px 22px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  color: inherit;
  font-family: inherit;
}
.warm-btn svg { width: 14px; height: 14px; }
```

Variants:

- `.warm-btn-primary` — ink background, paper text. Hover: `--warm-ink-soft`.
- `.warm-btn-accent` — accent background, white text. Hover: `--warm-accent-deep`.
- `.warm-btn-ghost` — paper background, `--warm-line` border, `--warm-ink-soft` text. Hover darkens border and text to `--warm-ink-soft`/`--warm-ink`.
- `.warm-btn-lg` — `padding: 16px 28px; font-size: 15px;`. Stack with any variant.

Notes:

- `color: inherit` means a button inside a dark section inherits its label color. That's used in `CTA` to render an outline button against ink.
- Nested `<svg>` inside `.warm-btn` auto-resizes to 14px, overriding the `Icon` default of 16px.

### Type helpers

- `.warm-display` — Fraunces display class (see Typography).
- `.warm-italic` — `font-style: italic` (convenience for classNames rather than `<em>`).
- `.warm-muted` — `color: var(--warm-mute)`.
- `.warm-accent-text` — `color: var(--warm-accent)`.

Links inside the theme are unstyled by default:

```css
[data-theme="warm"] a { color: inherit; text-decoration: none; }
```

Style them explicitly with `--warm-accent` and `text-decoration: underline` when you want them to read as links (see `warm-legal-prose` a / `Faq` inline email link).

### `.warm-legal-prose`

Used on markdown blog bodies and statically authored privacy / terms pages to style a dumped HTML tree. Full style map:

| Selector | Rule |
| --- | --- |
| `.warm-legal-prose` | `color: var(--warm-ink-soft); font-size: 16px; line-height: 1.7; overflow-x: auto;` |
| `.warm-legal-prose > * + *` | `margin-top: 14px;` |
| `p` | `margin: 0 0 14px; color: var(--warm-ink-soft);` |
| `h2` | Fraunces 32px, `font-weight: 500`, `letter-spacing: -0.02em`, `color: var(--warm-ink)`, `margin: 56px 0 16px; line-height: 1.1;` |
| `h3` | Fraunces 22px, `font-weight: 500`, `letter-spacing: -0.015em`, `color: var(--warm-ink)`, `margin: 36px 0 10px;` |
| `a` | `color: var(--warm-accent); text-decoration: underline; text-underline-offset: 3px;` |
| `strong` | `color: var(--warm-ink); font-weight: 500;` |
| `ul, ol` | `padding-left: 1.4rem; margin: 0 0 16px;` |
| `li` | `padding: 3px 0;` |
| `hr` | `margin: 36px 0; border: 0; height: 1px; background: var(--warm-line-soft);` |
| `blockquote` | `margin: 24px 0; padding: 12px 20px; border-left: 3px solid var(--warm-accent); background: var(--warm-paper); border-radius: 8px; color: var(--warm-ink-soft);` |
| `table` | Full width, separate borders, `background: var(--warm-paper)`, 1px `--warm-line` border, `border-radius: 14px; overflow: hidden; table-layout: auto;`. Kept as `display: table` so column balancing still works. |
| `thead` | `background: var(--warm-paper-2);` |
| `th` | Fraunces, `font-weight: 500`, `letter-spacing: -0.01em`, `color: var(--warm-ink)`, `padding: 14px 18px`, bottom border `--warm-line`. |
| `td` | `padding: 12px 18px`, bottom border `--warm-line-soft`, `color: var(--warm-ink-soft)`, `overflow-wrap: anywhere`. |
| `tr:last-child td` | no bottom border. |
| `tbody tr:nth-child(even) td` | `background: var(--warm-paper-2);` (zebra rows). |
| `th:first-child, td:first-child` | `font-weight: 500; color: var(--warm-ink);` |

The class also sets `overflow-x: auto` on itself so overly wide tables scroll the article container instead of breaking the table into block mode.

### Changelog utility classes

All scoped to `[data-theme="warm"]`. Intended to be composed in the order shown inside `ChangelogTimeline`.

| Class | Purpose |
| --- | --- |
| `.cl-head` | Page header block — `padding: 80px 0 48px; border-bottom: 1px solid var(--warm-line-soft);` |
| `.cl-grid` | Two-column layout. 1fr below 900px; `240px 1fr` with 80px gap at ≥900px. |
| `.cl-rail` | Side rail. Sticky (`top: 100px`) at ≥900px. `font-size: 13px`. |
| `.cl-rail-label` | Uppercase small label above the rail list (11px, `letter-spacing: 0.12em`). |
| `.cl-rail a` | Rail link — left-aligned 2px transparent border, hover sets `--warm-line`. |
| `.cl-rail-active` | Active rail entry — accent color + accent left border, `font-weight: 500`. |
| `.cl-entry` | Article wrapper, `margin-bottom: 96px`. |
| `.cl-entry-meta` | Flex row containing date + version + tag + latest dot. |
| `.cl-entry-date` | Fraunces italic 14px mute (`opsz` 14 for small-size optical sizing). |
| `.cl-entry-version` | Small outlined pill (`vX.Y.Z`), Inter 12px, paper bg, `--warm-line` border. |
| `.cl-entry-title` | Fraunces display h2. 36px / 44px at ≥768px. `em` inside resolves to italic accent color. |
| `.cl-entry-lede` | Fraunces 18px / 19px, `font-weight: 300`, `color: var(--warm-ink-soft)`, `max-width: 620px`. |
| `.cl-entry-hero` | 16:7 hero image wrapper — radius-lg, `--warm-line` border, `aspect-ratio: 16 / 7`, paper bg. Currently unused in live entries but styled for future use. |
| `.cl-entry-prose` | Markdown body (Inter 15px, 1.7 line-height). Overrides `p/strong/a/ul/ol/li/h2/h3/code/pre`. |
| `.cl-tag` | Category pill — 11px uppercase, rounded-full. |
| `.cl-tag-new` | sage bg (`#E4EADD`), `--warm-sage-deep` fg. |
| `.cl-tag-improved` | `--warm-cream` bg, `#A85B1E` fg. |
| `.cl-tag-fixed` | `#F0E6DE` bg, `--warm-ink-soft` fg. |
| `.cl-tag-shipped` | `#EDE1E6` bg, `--warm-plum` fg. |
| `.cl-divider` | "· · ·" divider between entries with `--warm-line-soft` flank lines. Fraunces 18px. |
| `.cl-subscribe` | Newsletter card, paper bg, radius-lg, 28px padding (36/40 at ≥720). |
| `.cl-subscribe-form` | Pill-shaped input+button row on `--warm-bg`. |
| `.cl-older` | "Back to top" link — accent colored, 14px, hover deep. |

### Raw animations

```css
@keyframes warm-slide-up {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Declared but not attached to any utility class yet — reserved for opt-in enter animations.

---

## 7. Primitives: Icon, Logo, Wordmark

Defined in `src/app/(landing)/_components/warm-primitives.tsx`.

### Icon set

```ts
const baseProps = { width: 16, height: 16 } as const;
```

Every icon spreads `baseProps` first so an unsized consumer gets a predictable 16×16, which stops SVGs from expanding to fill their flex container (previous bug: the Hero arrow blew up to full width on small screens).

Available icons:

- `Icon.Arrow` — horizontal arrow.
- `Icon.ArrowUpRight` — diagonal (external / open-in-new cue).
- `Icon.Check` — 1.75-weight checkmark.
- `Icon.Copy` — clipboard stack.
- `Icon.Link` — chain.
- `Icon.Chart` — vertical bars.
- `Icon.QR` — QR finder pattern.
- `Icon.Plus` — used in FAQ accordion (rotates 45° to form an ×).
- `Icon.Star` — filled, testimonials rating.
- `Icon.Heart` — filled.
- `Icon.Sparkle` — 4-point star fill.

Usage inside a button:

```tsx
<a className="warm-btn warm-btn-accent warm-btn-lg">
  Make a QR code <Icon.Arrow />
</a>
```

Because `.warm-btn svg` sets `width: 14px; height: 14px;`, the icon shrinks to 14px inside buttons and stays 16px everywhere else. Override per-site with an inline `style={{ width, height, color }}`.

### Logo

```tsx
<Logo size={22} color="currentColor" />
```

A single SVG "swirl" mark (two stroked arcs + two dots). `size` drives both width/height. `color` drives stroke and dot fill.

### Wordmark

```tsx
<Wordmark onInk={false} />
```

Composes `Logo` + the text "iShortn" followed by a terracotta period. Used in the landing header, the landing footer (with `onInk`), and the auth layout header. Inline style block:

```tsx
fontFamily: "var(--font-warm-display)",
fontSize: 24,
fontWeight: 500,
letterSpacing: "-0.02em",
```

The period is always `var(--warm-accent)`, even on ink.

---

## 8. Component Recipes

All landing components live in `src/app/(landing)/_components/`. Each is a pure presentational component; state (if any) is local. Responsive layout lives in per-component inline `<style>` tags with `@media` queries on custom class names like `.warm-hero-grid`.

### Header (`header.tsx`)

- `"use client"` — reads `window.scrollY` to toggle a blurred sticky state above 12px scroll.
- Sticky `position: sticky; top: 0; z-index: 50;` with `backdrop-filter: blur(12px)` when scrolled.
- Desktop nav shown via Tailwind `md:flex`; mobile menu is a custom button that expands a panel of `Link`s.
- Auth CTA swaps between signed-in (`Dashboard`) and signed-out (`Sign in` / `Get started`) using Clerk's `SignedIn` / `SignedOut`.
- Routes: Features, Pricing, Stories (anchor to `#stories`), Changelog.

### Hero (`hero.tsx`)

- Client component. Headline: Fraunces display, 54–104px, with an italic accent "lovely." on its own line.
- Left column: eyebrow + headline + supporting paragraph + pill-shaped input `<form>`.
- Submit handler:
  ```ts
  const target = `/auth/sign-up?url=${encodeURIComponent(trimmed)}`;
  window.location.assign(target);
  ```
  The URL handoff threads through the auth flow (see section 11).
- Right column: three rotated analytics cards stacked absolutely, hidden below 980px via a custom `.warm-hero-cards` class:
  ```css
  @media (min-width: 980px) {
    .warm-hero-grid { grid-template-columns: 1.3fr 1fr; }
    .warm-hero-cards { display: block; }
  }
  ```
- Below the fold: "Featured on" strip with Fraunces press logos. Copy is static.

Gotcha: card stacking uses literal pixel offsets and `transform: rotate(...)` per card — keep the three cards to stay inside the 460px column height.

### Dashboard preview (`dashboard-preview.tsx`)

- Server component. No state.
- Renders the full-bleed, chrome-wrapped screenshot of the real dashboard:
  ```tsx
  <Image
    src="/landing/dashboard-warm.png"
    width={2400}
    height={1400}
    sizes="(min-width: 1280px) 1184px, 100vw"
  />
  ```
- Chrome is a horizontal bar with three faux traffic lights, a URL pill (`app.ishortn.ink / dashboard`), and a "Live · synced 4s ago" tag.
- Parent card uses `.warm-card` plus a custom shadow `0 40px 80px -40px rgba(43,31,23,0.2)`.

### Features (`features.tsx`)

- Client component. 9 cards. Titles, body, bg, and visual kind live in an `items` array at the top.
- Grid: 1 column → 2 at ≥768px → 3 at ≥1100px.
- Each card is 340px min-height with `minHeight: "2.3em"` on the h3 so multi-line and single-line titles align.
- `FeatureVisual` renders a small bespoke illustration keyed on `kind`:
  - `analytics` — SVG bar chart with a `linearGradient` accent fade.
  - `domain` — "go.yourbrand.com" with the middle chunk highlighted.
  - `lock` — protected-link card with expiry pill.
  - `geo` — three pill rows routing to `/us`, `/jp`, `/global`.
  - `dynamic-qr` — real QR rendered with `uqr` and a centered accent-colored square overlay.
  - `utm` — monospace `utm_*` line list.
  - `milestones` — progress bars.
  - `cloaking` — verified-vs-bots progress bar.
  - `team` — stacked avatar pills.
- `DynamicQRVisual` encodes `https://ishortn.ink` at ECC `H` so the center overlay doesn't break scans:
  ```ts
  encode("https://ishortn.ink", { ecc: "H", border: 0 });
  ```

### QR section (`qr-section.tsx`)

- Client component. State: selected style (`"square" | "rounded" | "dot" | "squircle"`).
- Encodes `https://ishortn.ink/dashboard` once (`useMemo`) at ECC `H`, border 0.
- Renders QR via a custom `QRCanvas` that maps each boolean module to either a `<circle>` (dot style) or a `<rect>` with variable `rx` (squircle 0.45, rounded 0.3, square 0).
- Clickable 68×68 style-picker swatches; active state swaps bg to accent and inverts fg.
- Right-side large preview: 32px radius paper card, aspect-ratio 1/1, 48px inset padding. Centered `Logo` overlay sits on an accent square with a 10px paper ring (`boxShadow: "0 0 0 10px var(--warm-paper)"`) so it reads as a sticker and preserves scan integrity.
- Two CTAs: "Make a QR code" → `/dashboard/qrcodes/create`; "See examples" → `/features`.

### Pricing (`pricing.tsx`)

- Static Free / Pro / Ultra, numbers hand-matched to `src/lib/billing/plans.ts` (`PLAN_CAPS`) — Free 30 links + 1,000 events + 7-day analytics; Pro $5/mo 1,000 links + 10,000 events + 3 domains; Ultra $15/mo unlimited.
- 1 column → 3 at ≥780px.
- `featured` card (Pro) uses `--warm-ink` bg with white text and a top-left "♥ Most popular" ribbon. Non-featured cards use paper bg.
- Button style selected by plan key: `ghost | accent | primary`.
- Bullet list uses `Icon.Check` in sage-deep on paper cards, accent on the featured dark card.

When you change pricing numbers, update `src/app/(landing)/_components/pricing.tsx` and `src/lib/billing/plans.ts` together — and the compare-page `ishortn` object in `src/app/(landing)/compare/[slug]/page.tsx`.

### Testimonials (`testimonials.tsx`)

- Bento grid on ≥800px: `grid-template-columns: repeat(6, 1fr);` each quote spans a variable number of columns:
  - The featured "large" quote spans 4.
  - The second quote spans 2.
  - All others span 3.
- Backgrounds cycle through `[ink, cream, bg, accent, paper]` — even indices (0, 3) render light text on dark. That's controlled by the `onDark` boolean.
- Large card uses Fraunces 28px for the quote; small cards use Inter 15px.
- Avatar circle shows the first character of the name.

### FAQ (`faq.tsx`)

- Client component with a single-open accordion (`useState<number>(0)`, click to toggle, -1 means closed).
- Two-column layout at ≥860px: sticky intro on the left, question list on the right.
- Each question is a button that toggles a `max-height` transition (0 ↔ 400px) on the answer.
- The `+` glyph rotates 45° to become ×.

### CTA (`cta.tsx`)

- Full-bleed ink section, 160px vertical padding.
- Background decoration: oversized italic "shortn" wordmark at 4% white opacity, absolutely centered, pointer-events off.
- Eyebrow overridden inline to a translucent white background.
- Two CTAs: accent "Start for free" → `Paths.Signup`; ghost-on-ink "See a quick demo" → `/#features`.
- Trust row: three `Icon.Check` bullets.

### Footer (`footer.tsx`)

- Ink background, paper text. 80px top padding, 40px bottom.
- Four-column grid at ≥1024px (`1.4fr repeat(4, 1fr)`), two-column at ≥720px.
- Links split into Product / Compare / Resources / Legal. External and `mailto:` links use `<a>` with `target="_blank"` (external only); internal links use `next-view-transitions`'s `Link`.
- Oversized decorative "iShortn." at the bottom (20vw, 4% white opacity), italic, with the period in accent.
- Social chiclets: 36×36 outlined circles for 𝕏, GH, @.

---

## 9. Changelog System

Markdown files live in `content/changelogs/YYYY-MM-DD-slug.md`. `src/lib/changelog/index.ts` reads them; `src/lib/changelog/types.ts` defines the schema.

### Frontmatter

```md
---
date: 2026-03-10T12:00:00
version: 2.2.0
title: Click Milestone Notifications
shortDesc: Get notified by email when your links hit click thresholds
category: new
---
```

- `date` — ISO datetime string. Either a date-only (`2025-12-18`) or full datetime (`2025-12-18T14:30:00`) value works; the renderer parses with `date-fns`'s `parseISO`.
- `version` — semver. Rendered as `vX.Y.Z`.
- `title` — display title. `em` inside the rendered title resolves to italic accent color (`.cl-entry-title em`).
- `shortDesc` — lede paragraph under the title.
- `category` — one of `new | improved | fixed | shipped` (see `ChangelogCategory`).

### Category enum

```ts
export type ChangelogCategory = "new" | "improved" | "fixed" | "shipped";
```

Historical note: earlier drafts used `feature | improvement | fix | breaking`. Those were migrated to `new | improved | fixed | shipped` respectively. If you ever encounter the old values in a PR, translate them.

All 15 shipped entries at the time of writing use either `new` or `improved`. `fixed` and `shipped` are supported by the renderer (`.cl-tag-fixed`, `.cl-tag-shipped`) but not currently used in content.

### Rendering flow

1. `changelog/page.tsx` calls `getChangelogEntries()` and passes them to `ChangelogTimeline`.
2. `ChangelogHero` renders the page h1 inside `.cl-head`.
3. `ChangelogTimeline` (client component) builds the two-column `.cl-grid`:
   - Left rail (`.cl-rail`) lists each entry with `vX.Y.Z` + formatted date. An `IntersectionObserver` with `rootMargin: "-40% 0px -55% 0px"` marks the currently-visible entry as `.cl-rail-active`.
   - Right column opens with a `.cl-subscribe` card (email input + accent button) and then iterates entries as `.cl-entry` articles separated by `.cl-divider` "· · ·" blocks.
4. Each `Entry` renders `.cl-entry-meta` (date / version / category pill / "Latest" indicator for the first one), the `.cl-entry-title`, optional `.cl-entry-lede`, and finally the markdown body via `dangerouslySetInnerHTML` inside `.cl-entry-prose` (remark parses server-side).

### Category → pill mapping

```ts
const categoryLabels: Record<ChangelogCategory, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
  shipped: "Shipped",
};
```

Paired with these CSS rules:

```css
.cl-tag-new      { background: #E4EADD;             color: var(--warm-sage-deep); }
.cl-tag-improved { background: var(--warm-cream);   color: #A85B1E; }
.cl-tag-fixed    { background: #F0E6DE;             color: var(--warm-ink-soft); }
.cl-tag-shipped  { background: #EDE1E6;             color: var(--warm-plum); }
```

---

## 10. Blog and Legal Pages

`/blog`, `/blog/[slug]`, `/compare/[slug]`, `/privacy`, `/terms` all share the same surface language:

- Page background `var(--warm-bg)`.
- Standard `Header` / `Footer` from `(landing)/_components`.
- Hero: eyebrow + Fraunces h1 using `clamp(54px, 9vw, 104px)` + mute lede.

Markdown or long-form HTML is rendered into an `<article className="warm-container warm-legal-prose">`. For markdown posts (`/blog/[slug]`, `/privacy`, `/terms`), the HTML is injected via `dangerouslySetInnerHTML` (parsed server-side through remark for blog / changelog; hand-authored JSX for privacy/terms).

Blog listing (`/blog`) is a card grid: 1 → 2 (≥720px) → 3 (≥1024px) columns. Cards use paper bg, `--warm-line` border, `border-radius: 24`. A Fraunces 26px title, 3-line `-webkit-line-clamp` description, date + reading time meta, and a terracotta "Read article →" row.

Compare pages (`/compare/[slug]`) additionally render a 3-column feature table inside a `.warm-card` wrapper. The table has its own `div`-based implementation (not an HTML `<table>`) because it needs per-cell column shading and a cleaner border treatment; it still uses `var(--warm-line-soft)` dividers and `--warm-paper-2` as the subtle row background.

`warm-legal-prose` tables are reserved for markdown-generated content — see section 6.

---

## 11. Auth (Clerk) Theming

Entry points:

- `src/app/(auth)/auth/layout.tsx` — wraps children with `data-theme="warm" data-accent="terracotta"`, sets the three-row grid (header `Wordmark`, main content, small footer), and declares the same `var(--warm-bg)` / `var(--warm-ink)` surface.
- `src/app/(auth)/auth/sign-in/[[...sign-in]]/page.tsx` and `sign-up/[[...sign-up]]/page.tsx` — render Clerk's `<SignIn>` / `<SignUp>` with `appearance={warmClerkAppearance}`.

### `warmClerkAppearance`

Lives in `src/app/(auth)/auth/_shared/clerk-appearance.ts`. It is a static `Appearance` object — no runtime state, no theme lookups.

Layout:

```ts
layout: {
  logoPlacement: "none",              // we render our own wordmark outside
  socialButtonsPlacement: "top",
  socialButtonsVariant: "blockButton",
  showOptionalFields: true,
  privacyPageUrl: "/privacy",
  termsPageUrl: "/terms",
},
```

`logoPlacement: "none"` is load-bearing — without it, Clerk renders a duplicate mark at the top of the card.

Variables map directly to warm palette values (kept in sync with CSS variables by hand):

```ts
colorPrimary:        "#2B1F17" (ink)
colorText:           "#2B1F17"
colorTextSecondary:  "#8A7868" (mute)
colorBackground:     "#FFFCF5" (paper)
colorInputBackground:"#F7F1E8" (bg)
colorInputText:      "#2B1F17"
colorNeutral:        "#2B1F17"
colorDanger:         "#B1482A"
colorSuccess:        "#6E8A66"
fontFamily:          "var(--font-warm-ui), Inter, system-ui, sans-serif"
fontFamilyButtons:   same
borderRadius:        "14px"
spacingUnit:         "1rem"
```

### `elements` map

| Clerk element | Override |
| --- | --- |
| `rootBox` | width 100%, `maxWidth: 440`, centered, warm-ui font |
| `cardBox` | `boxShadow: "0 40px 80px -40px rgba(43,31,23,0.18)"`, `--warm-line` border, `borderRadius: 24`, paper bg |
| `card` | paper bg, no shadow/border (handled by `cardBox`), `borderRadius: 24`, `padding: "40px 32px"` |
| `headerTitle` | Fraunces display, `font-weight: 500`, `font-size: 28`, `letter-spacing: -0.02em`, ink |
| `headerSubtitle` | mute, 14px |
| `formFieldLabel` | ink-soft, 13px, `font-weight: 500` |
| `formFieldInput` | `--warm-bg` bg, `--warm-line` border, radius 12, ink text, `padding: 12px 14px`, 14px, no shadow |
| `formButtonPrimary` | ink bg, paper text, no border/outline/shadow, radius 999, `padding: 12px 20px`, 14px / 500, `text-transform: none` |
| `socialButtonsBlockButton` | paper bg, `--warm-line` border, radius 999, ink-soft text, `minHeight: 48`, `padding: 12px 18px`, 14px |
| `socialButtonsBlockButtonText` | ink-soft, `font-weight: 500`, 14px |
| `socialButtonsProviderIcon` | 18×18 |
| `dividerLine` | `--warm-line-soft` bg |
| `dividerText` | mute, 12px |
| `footerActionLink` | terracotta, `font-weight: 500` |
| `formFieldErrorText` | `#B1482A`, 12px |
| `alertText` | ink-soft, 13px |
| `identityPreview` | `--warm-bg` bg, `--warm-line` border, radius 12 |
| `footer` | transparent bg, top border `--warm-line-soft` |

### Interaction overrides in CSS

Hover, focus, and `focus-visible` states cannot be expressed in `appearance.elements`. They live in `globals.css` under `[data-theme="warm"]` and target the stable `.cl-*` class names Clerk assigns:

```css
[data-theme="warm"] .cl-formButtonPrimary,
[data-theme="warm"] .cl-formButtonPrimary:focus,
[data-theme="warm"] .cl-formButtonPrimary:active {
  box-shadow: none !important;
  border: none !important;
  outline: none !important;
}
[data-theme="warm"] .cl-formButtonPrimary:hover {
  background: #4A3A2E !important;
  box-shadow: none !important;
}
[data-theme="warm"] .cl-formButtonPrimary:focus-visible {
  box-shadow: 0 0 0 3px rgba(200, 92, 59, 0.28) !important;
}
[data-theme="warm"] .cl-formFieldInput:focus,
[data-theme="warm"] .cl-formFieldInput:focus-within {
  border-color: #C85C3B !important;
  box-shadow: 0 0 0 3px rgba(200, 92, 59, 0.15) !important;
  outline: none !important;
}
[data-theme="warm"] .cl-socialButtonsBlockButton {
  min-height: 48px !important;
  padding: 12px 18px !important;
  font-size: 14px !important;
}
[data-theme="warm"] .cl-socialButtonsBlockButton:hover {
  border-color: #4A3A2E !important;
  color: #2B1F17 !important;
}
[data-theme="warm"] .cl-footerActionLink:hover { color: #A84724 !important; }
[data-theme="warm"] .cl-internal-b3fm6y,
[data-theme="warm"] .cl-badge { background: transparent !important; }
```

`!important` is required because Clerk ships specific runtime styles that otherwise beat the theme.

### URL handoff: hero → sign-up → new link

Three places cooperate to pre-fill the new-link page with a URL pasted in the hero:

1. `Hero` submits to `/auth/sign-up?url=<encoded>`:
   ```ts
   const target = `/auth/sign-up?url=${encodeURIComponent(trimmed)}`;
   window.location.assign(target);
   ```
2. Both `/auth/sign-in` and `/auth/sign-up` read `searchParams.url` and pass it through Clerk:
   ```tsx
   const afterSignUpUrl = url
     ? `/dashboard/link/new?url=${encodeURIComponent(url)}`
     : "/dashboard";
   return <SignUp forceRedirectUrl={afterSignUpUrl} signInForceRedirectUrl={afterSignUpUrl} ... />;
   ```
   (Matching `SignIn` equivalents: `forceRedirectUrl` + `signUpForceRedirectUrl`.)
3. `src/app/(main)/dashboard/link/new/page.tsx` reads `useSearchParams()`:
   ```ts
   const searchParams = useSearchParams();
   const initialUrl = searchParams.get("url") ?? undefined;
   const [destinationURL, setDestinationURL] = useState<string | undefined>(initialUrl);
   ```
   That `initialUrl` seeds the link form so the user lands directly on a pre-filled create screen.

Do not break this contract. If you rename the param, update all three files.

---

## 12. Icons and Images

- `src/app/(landing)/_components/warm-primitives.tsx` owns every decorative SVG used in landing.
- The `Icon.*` set defaults to 16×16 via `baseProps`. Custom SVGs added inline in components (CTA hamburger, FAQ +, arrow in hero cards, feature visuals) must also declare explicit `width` and `height` on the `<svg>` element. Previous bug: an arrow with no intrinsic sizing expanded to the full flex column width inside the Hero form.
- The dashboard screenshot (`DashboardPreview`) is `/landing/dashboard-warm.png`, a 2400×1400 PNG that already matches the warm palette. Replace the file, not the component props.
- Logos / wordmark use the `Logo` and `Wordmark` primitives so the accent period stays consistent across header, footer, auth, and compare pages.

---

## 13. Responsive Approach

Mobile-first. Each component defines its own breakpoints through an inline `<style>` tag that targets custom class names declared in its JSX. Example from `Hero`:

```tsx
<style>{`
  .warm-hero-grid { grid-template-columns: 1fr; }
  .warm-hero-cards { display: none; }
  @media (min-width: 980px) {
    .warm-hero-grid { grid-template-columns: 1.3fr 1fr; }
    .warm-hero-cards { display: block; }
  }
`}</style>
```

Breakpoints observed across the codebase:

| Breakpoint | Used in |
| --- | --- |
| 720px | `.cl-subscribe` two-column, footer 2-col, blog grid 2-col |
| 768px | container padding 48px, section padding 120px, changelog entry title 44px, features grid 2-col |
| 780px | pricing grid 3-col |
| 800px | testimonials header + grid, compare switch + pricing grid 2-col |
| 860px | FAQ sticky two-column |
| 900px | changelog grid 240+1fr, sticky rail |
| 960px | QR section two-column |
| 980px | hero two-column (headline + cards) |
| 1024px | footer 5-col, blog grid 3-col |
| 1100px | features grid 3-col |

Tailwind's `md:` (≥768px) is only used in `Header` for showing/hiding the nav pieces. Prefer inline `<style>` media queries for new warm components unless you're already reaching for Tailwind.

---

## 14. Do's and Don'ts

- DO scope any new warm-themed component under `[data-theme="warm"]`. All warm CSS selectors depend on this ancestor.
- DO use CSS variables for color and radius. Do not hardcode warm hex values outside the `[data-theme="warm"]` base block in `globals.css` (the sole allowed exceptions are the small category-tag background hexes like `#E4EADD` / `#F0E6DE` / `#EDE1E6` that intentionally sit next to the cream/plum tokens).
- DON'T apply the warm theme to anything under `src/app/(main)/dashboard/**`. The dashboard has its own existing theme and palette; bleeding warm tokens in will cause regressions.
- DO use real `<em>` for italic display type so Fraunces's true italic glyphs load. `transform: skew` is forbidden.
- DON'T use emojis in prose, UI copy, or commit messages.
- DO give every custom SVG (Icon set, Logo, inline `<svg>` decorations) an explicit `width` and `height` default. Unsized SVGs inside flex containers expand to the cross-axis size.
- DON'T put "500 links" / "free for X" specific quotas into hero, CTA, features, or footer marketing copy. Quotas belong in the Pricing cards and FAQ answers only, and must match `PLAN_CAPS` in `src/lib/billing/plans.ts`.
- DO refer to the real domain `ishortn.ink`. `isht.ink` should not appear in user-facing copy.
- DO reuse `.warm-btn` + variant combos for any new CTA. Hand-rolling a new button class should be rare and requires a reason.
- DO update Clerk hover/focus rules in `globals.css`, not in the `appearance` object — Clerk's runtime styles win over `elements` for interactive states.

---

## 15. File Map / Cheat Sheet

| I want to change... | Edit |
| --- | --- |
| Any color, radius, or base typography token | `src/styles/globals.css` — the `[data-theme="warm"]` block |
| An accent alternative (sage / plum) | `src/styles/globals.css` — `[data-theme="warm"][data-accent="..."]` |
| Font loading (Fraunces / Inter / axes) | `src/lib/fonts.ts` |
| Where font CSS variables get injected | `src/app/layout.tsx` — `<body className>` |
| Enable the theme on a new subtree | Wrap the root of that layout with `<div data-theme="warm">` |
| Landing page composition / order | `src/app/(landing)/page.tsx` |
| Landing section visuals | `src/app/(landing)/_components/*.tsx` |
| Icon set / Logo / Wordmark | `src/app/(landing)/_components/warm-primitives.tsx` |
| Header navigation links | `src/app/(landing)/_components/header.tsx` — `routes` array |
| Footer columns / socials | `src/app/(landing)/_components/footer.tsx` — `columns` / `socials` arrays |
| Pricing numbers | `src/app/(landing)/_components/pricing.tsx` AND `src/lib/billing/plans.ts` AND the `ishortn` object in `src/app/(landing)/compare/[slug]/page.tsx` |
| FAQ questions | `src/app/(landing)/_components/faq.tsx` — `defaultFaqs` |
| Hero illustrated cards | `src/app/(landing)/_components/hero.tsx` — `heroCards` |
| Feature cards / visuals | `src/app/(landing)/_components/features.tsx` — `items` array and `FeatureVisual` |
| QR demo target URL / styles | `src/app/(landing)/_components/qr-section.tsx` — `QR_TEXT` and `STYLES` |
| Testimonials content / bento spans | `src/app/(landing)/_components/testimonials.tsx` — `quotes` |
| Dashboard screenshot | `public/landing/dashboard-warm.png` |
| CTA section copy | `src/app/(landing)/_components/cta.tsx` |
| Blog listing layout | `src/app/(landing)/blog/page.tsx` |
| Individual blog post shell | `src/app/(landing)/blog/[slug]/page.tsx` |
| Privacy / terms body | `src/app/(landing)/privacy/page.tsx` / `terms/page.tsx` |
| Compare page feature table / pricing card | `src/app/(landing)/compare/[slug]/page.tsx` |
| Competitor list for compare pages | `src/lib/seo/competitors.ts` |
| Changelog page shell | `src/app/(landing)/changelog/page.tsx` |
| Changelog hero copy | `src/app/(landing)/changelog/_components/changelog-hero.tsx` |
| Timeline / rail / entry rendering | `src/app/(landing)/changelog/_components/changelog-timeline.tsx` |
| Changelog entry category labels | `changelog-timeline.tsx` — `categoryLabels` |
| Add a changelog entry | Create `content/changelogs/YYYY-MM-DD-slug.md` with the frontmatter in section 9 |
| Changelog CSS (pills, rail, prose) | `src/styles/globals.css` — `.cl-*` selectors |
| Auth layout (header wordmark, footer tagline) | `src/app/(auth)/auth/layout.tsx` |
| Clerk appearance | `src/app/(auth)/auth/_shared/clerk-appearance.ts` |
| Clerk hover / focus / min-heights | `src/styles/globals.css` — `.cl-*` selectors near the bottom |
| Sign-up / sign-in redirect handling | `src/app/(auth)/auth/sign-up/[[...sign-up]]/page.tsx` and `sign-in/[[...sign-in]]/page.tsx` |
| New-link URL pre-fill | `src/app/(main)/dashboard/link/new/page.tsx` — `useSearchParams().get("url")` |

---

## How to Extend

### Add a new color token

1. Add the CSS variable inside the `[data-theme="warm"]` block in `src/styles/globals.css`. Name it `--warm-<role>`; pick a role, not a color (`--warm-warning`, not `--warm-yellow`).
2. If the token needs a theme variant (`data-accent="sage"` etc.), add an override block below the existing ones.
3. Add a row to section 3 of this document with hex, intent, and typical use.
4. Reference it from components via `var(--warm-<role>)`. Never inline the hex.

### Add a new utility class

1. Add the rule inside `[data-theme="warm"]` in `globals.css`. Prefix the class with `warm-` (or `cl-` if it's changelog-specific). Scoping prevents accidental leakage into the dashboard.
2. If the class has responsive variants, place them in the same `globals.css` block with `@media (min-width: ...)`. Do not scatter breakpoints across component files for shared utilities.
3. Document the class in section 6 with selector, rules, and a TSX usage example.
4. Add a row to section 15 mapping the user intent ("change foo styling") to the file.

### Add a new Clerk element override

1. Find the Clerk element's stable class name (inspect the DOM — it will be `cl-someElement`).
2. For static styles, add it to `elements` in `src/app/(auth)/auth/_shared/clerk-appearance.ts`. Prefer this path.
3. For hover / focus / focus-visible / active states, append a rule inside `globals.css`:
   ```css
   [data-theme="warm"] .cl-yourElement:hover {
     background: #4A3A2E !important;
   }
   ```
   You need `!important` because Clerk's runtime styles ship later and beat unscoped rules.
4. If the override requires a pixel value already used elsewhere (e.g. `48px` min-height), reuse the same literal — we keep these numbers aligned by hand with the landing theme.

### Add a new changelog entry

1. Create `content/changelogs/YYYY-MM-DD-slug.md`.
2. Use the frontmatter shape from section 9. Category must be one of `new | improved | fixed | shipped`.
3. Write the body in normal markdown. It will be rendered inside `.cl-entry-prose`, which already styles `p / strong / a / ul / ol / li / h2 / h3 / code / pre`. No need to add custom HTML.
4. The newest file by `date` automatically shows the "Latest" indicator and becomes the initial active rail entry.
