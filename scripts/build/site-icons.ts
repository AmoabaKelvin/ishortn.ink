// bun scripts/build/site-icons.ts: writes public/site-icons.svg, the sprite behind <SiteIcon>
// (src/app/(landing)/_components/site-icon.tsx). Run it after changing siteIconNames or upgrading
// @tabler/icons-react; site-icons.test.ts fails while the committed file is stale.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  IconAppsFilled,
  IconArrowNarrowDown,
  IconBellFilled,
  IconBookFilled,
  IconBrandGithub,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandTiktok,
  IconBrandWhatsapp,
  IconBrandX,
  IconBrandYoutube,
  IconBulbFilled,
  IconCalendarFilled,
  IconChartAreaLineFilled,
  IconChevronDown,
  IconChevronRight,
  IconClockFilled,
  IconCodeCircleFilled,
  IconCopy,
  IconFileUploadFilled,
  IconFolderFilled,
  IconHelpCircleFilled,
  IconLink,
  IconLockFilled,
  IconMail,
  IconMapPinFilled,
  IconMessageCircleFilled,
  IconPlus,
  IconQrcode,
  IconSelector,
  IconShieldCheckFilled,
  IconSparklesFilled,
  IconTagFilled,
  IconUserFilled,
} from "@tabler/icons-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { siteIconNames, type SiteIconName } from "@/app/(landing)/_components/site-icon";

import type { TablerIcon } from "@tabler/icons-react";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
export const SPRITE_PATH = path.resolve(path.dirname(SCRIPT_PATH), "../../public/site-icons.svg");

const icons = {
  "apps-filled": IconAppsFilled,
  "arrow-narrow-down": IconArrowNarrowDown,
  "bell-filled": IconBellFilled,
  "book-filled": IconBookFilled,
  "brand-github": IconBrandGithub,
  "brand-instagram": IconBrandInstagram,
  "brand-linkedin": IconBrandLinkedin,
  "brand-tiktok": IconBrandTiktok,
  "brand-whatsapp": IconBrandWhatsapp,
  "brand-x": IconBrandX,
  "brand-youtube": IconBrandYoutube,
  "bulb-filled": IconBulbFilled,
  "calendar-filled": IconCalendarFilled,
  "chart-area-line-filled": IconChartAreaLineFilled,
  "chevron-down": IconChevronDown,
  "chevron-right": IconChevronRight,
  "clock-filled": IconClockFilled,
  "code-circle-filled": IconCodeCircleFilled,
  copy: IconCopy,
  "file-upload-filled": IconFileUploadFilled,
  "folder-filled": IconFolderFilled,
  "help-circle-filled": IconHelpCircleFilled,
  link: IconLink,
  "lock-filled": IconLockFilled,
  mail: IconMail,
  "map-pin-filled": IconMapPinFilled,
  "message-circle-filled": IconMessageCircleFilled,
  plus: IconPlus,
  qrcode: IconQrcode,
  selector: IconSelector,
  "shield-check-filled": IconShieldCheckFilled,
  "sparkles-filled": IconSparklesFilled,
  "tag-filled": IconTagFilled,
  "user-filled": IconUserFilled,
} satisfies Record<SiteIconName, TablerIcon>;

// Renders the Tabler component and turns its <svg> into a <symbol>, keeping the drawing attributes
// (fill, stroke, stroke-width, ...) and dropping the ones the <SiteIcon> svg sets itself.
const toSymbol = (name: SiteIconName) => {
  const markup = renderToStaticMarkup(createElement(icons[name]));
  const match = markup.match(/^<svg([^>]*)>([\s\S]*)<\/svg>$/);
  if (!match?.[1] || match[2] === undefined) throw new Error(`Unexpected markup for ${name}`);
  const attributes = match[1].replace(/\s(xmlns|width|height|class)="[^"]*"/g, "");
  return `<symbol id="${name}"${attributes}>${match[2]}</symbol>`;
};

export const buildSiteIconSprite = () =>
  `<svg xmlns="http://www.w3.org/2000/svg">\n${siteIconNames.map(toSymbol).join("\n")}\n</svg>\n`;

if (process.argv[1] === SCRIPT_PATH) writeFileSync(SPRITE_PATH, buildSiteIconSprite());
