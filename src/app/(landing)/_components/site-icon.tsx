// Tabler icons for the marketing sections below the fold, drawn from one cached sprite
// (public/site-icons.svg, written by scripts/build/site-icons.ts) instead of inline paths. Each
// use is an <svg> and a <use> with no path data, which keeps the HTML, the RSC payload and the
// tree React hydrates smaller. Anything that can sit above the fold on some page (header, hero,
// ButtonLink, Pricing, CheckList) keeps inline icons so the first paint never waits on the sprite.
// Names are Tabler's; filled variants end in "-filled".
export const siteIconNames = [
  "apps-filled",
  "arrow-narrow-down",
  "bell-filled",
  "book-filled",
  "brand-github",
  "brand-instagram",
  "brand-linkedin",
  "brand-tiktok",
  "brand-whatsapp",
  "brand-x",
  "brand-youtube",
  "bulb-filled",
  "calendar-filled",
  "chart-area-line-filled",
  "chevron-down",
  "chevron-right",
  "clock-filled",
  "code-circle-filled",
  "copy",
  "file-upload-filled",
  "folder-filled",
  "help-circle-filled",
  "link",
  "lock-filled",
  "mail",
  "map-pin-filled",
  "message-circle-filled",
  "plus",
  "qrcode",
  "quote-filled",
  "selector",
  "shield-check-filled",
  "sparkles-filled",
  "tag-filled",
  "user-filled",
] as const;

export type SiteIconName = (typeof siteIconNames)[number];

export const SITE_ICON_SPRITE = "/site-icons.svg";

/** Decorative icon from the sprite; size it with `className` like a Tabler icon. */
export const SiteIcon = ({ name, className }: { name: SiteIconName; className?: string }) => (
  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" className={className}>
    <use href={`${SITE_ICON_SPRITE}#${name}`} />
  </svg>
);
