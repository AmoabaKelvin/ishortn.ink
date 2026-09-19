import {
  IconBellFilled,
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandX,
  IconBrandYoutube,
  IconCalendarFilled,
  IconChevronDown,
  IconClockFilled,
  IconCodeCircleFilled,
  IconFileUploadFilled,
  IconFolderFilled,
  IconLockFilled,
  IconMapPinFilled,
  IconQrcode,
  IconShieldCheckFilled,
  IconSparklesFilled,
  IconTagFilled,
  IconUserFilled,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import {
  bodyClass,
  cardClass,
  Eyebrow,
  h2Class,
  h3Class,
  IconPlate,
  Section,
  SectionHeading,
} from "./site-primitives";

import type { ReactNode } from "react";

/* ------------------------------ Mock bits ------------------------------ */

const mockClass = "relative -mb-6 flex-1 rounded-t-xl bg-white shadow-site-card";
const fieldClass =
  "flex items-center justify-between gap-2 rounded-[10px] bg-white px-3 py-2 text-[0.8125rem] text-neutral-900 shadow-site-btn";
const fieldLabelClass = "mb-1.5 text-xs font-medium text-neutral-600";

const StackedPaper = () => (
  <div className="absolute inset-x-4 -top-2 h-4 rounded-t-xl bg-white shadow-site-card" />
);

const Toggle = ({ on }: { on: boolean }) => (
  <span
    className={cn(
      "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5",
      on ? "justify-end bg-neutral-900" : "bg-neutral-200",
    )}
  >
    <span className="size-4 rounded-full bg-white shadow-sm" />
  </span>
);

/* -------------------------------- Mocks -------------------------------- */

const clicks = [38, 52, 44, 61, 49, 72, 58, 80, 66, 91, 74, 100, 83, 69];
const referrers = [
  { name: "x.com", pct: 42 },
  { name: "google.com", pct: 27 },
  { name: "Newsletter", pct: 18 },
  { name: "Direct", pct: 13 },
];
const devices = [
  { name: "Mobile", pct: 64 },
  { name: "Desktop", pct: 31 },
  { name: "Tablet", pct: 5 },
];

const Breakdown = ({ title, rows }: { title: string; rows: { name: string; pct: number }[] }) => (
  <div className="min-w-0">
    <div className="text-xs font-medium text-neutral-600">{title}</div>
    <div className="mt-2 space-y-1.5">
      {rows.map((row) => (
        <div key={row.name} className="relative overflow-hidden rounded-md bg-neutral-50">
          <div
            className="absolute inset-y-0 left-0 rounded-md bg-neutral-950/[0.07]"
            style={{ width: `${row.pct}%` }}
          />
          <div className="relative flex justify-between gap-2 px-2 py-1 text-xs">
            <span className="truncate text-neutral-900">{row.name}</span>
            <span className="tabular-nums text-neutral-600">{row.pct}%</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AnalyticsMock = () => (
  <div className={cn(mockClass, "p-4 sm:p-5")}>
    <div className="flex items-center justify-between gap-3">
      <span className="truncate font-mono text-xs text-neutral-600">ishortn.ink/launch</span>
      <div className="flex shrink-0 rounded-lg bg-neutral-100 p-0.5 text-xs font-medium text-neutral-600">
        <span className="px-2 py-0.5">7d</span>
        <span className="rounded-md bg-white px-2 py-0.5 text-neutral-900 shadow-site-btn">
          30d
        </span>
        <span className="px-2 py-0.5">90d</span>
      </div>
    </div>
    <div className="mt-4 flex items-baseline gap-2">
      <span className="font-title text-2xl font-semibold tracking-tight text-neutral-900">
        24,847
      </span>
      <span className="text-xs text-neutral-600">clicks</span>
      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
        +12%
      </span>
    </div>
    <div className="mt-4 flex h-24 items-end gap-1.5 border-b border-neutral-950/[0.07]">
      {clicks.map((h, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-t-[3px]", h === 100 ? "bg-neutral-900" : "bg-neutral-300")}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
    <div className="mt-4 grid grid-cols-2 gap-4">
      <Breakdown title="Referrers" rows={referrers} />
      <Breakdown title="Devices" rows={devices} />
    </div>
  </div>
);

const BrandedLinkMock = () => (
  <div className={cn(mockClass, "mt-3 px-4 pb-4 pt-7 sm:px-5")}>
    <span className="absolute -top-3 left-4 rounded-md bg-neutral-200 px-2 py-1 font-mono text-xs font-medium text-neutral-800 sm:left-5">
      links.yourbrand.com/sale
    </span>
    <div className="text-sm font-semibold text-neutral-900">Summer sale</div>
    <div className="mt-0.5 truncate text-xs text-neutral-600">
      yourbrand.com/collections/summer-sale
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div>
        <div className={fieldLabelClass}>Domain</div>
        <div className={fieldClass}>
          <span className="truncate">links.yourbrand.com</span>
          <IconChevronDown className="size-4 shrink-0 text-neutral-500" />
        </div>
      </div>
      <div>
        <div className={fieldLabelClass}>Alias</div>
        <div className={fieldClass}>
          <span className="truncate">sale</span>
        </div>
      </div>
    </div>
    <div className="mt-4 space-y-2.5 border-t border-neutral-950/[0.07] pt-4 text-[0.8125rem] text-neutral-700">
      <div className="flex items-center gap-2">
        <IconQrcode className="size-4 shrink-0 text-neutral-500" />
        QR code included
      </div>
      <div className="flex items-center gap-2">
        <IconTagFilled className="size-4 shrink-0 text-neutral-500" />
        Tagged: campaigns
      </div>
      <div className="flex items-center gap-2">
        <IconFolderFilled className="size-4 shrink-0 text-neutral-500" />
        Folder: Summer 2026
      </div>
    </div>
  </div>
);

const bioLinks = [
  "Shop the summer sale",
  "Watch the latest video",
  "Join the newsletter",
  "Book a session",
];

const BioMock = () => (
  <div className="-mb-6 flex flex-1 justify-center">
    <div className="flex w-60 flex-col rounded-t-[2rem] bg-neutral-900 p-2 pb-0">
      <div className="flex flex-1 flex-col items-center rounded-t-[1.5rem] bg-neutral-50 px-4 pt-6">
        <span className="grid size-12 place-items-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 outline outline-1 -outline-offset-1 outline-black/5">
          YB
        </span>
        <div className="mt-2 text-sm font-semibold text-neutral-900">Your Brand</div>
        <div className="font-mono text-xs text-neutral-600">ishortn.ink/p/yourbrand</div>
        <div className="mt-3 flex gap-2.5 text-neutral-700">
          <IconBrandInstagram className="size-4 shrink-0" />
          <IconBrandTiktok className="size-4 shrink-0" />
          <IconBrandYoutube className="size-4 shrink-0" />
          <IconBrandX className="size-4 shrink-0" />
        </div>
        <div className="mt-4 w-full space-y-2">
          {bioLinks.map((label) => (
            <div
              key={label}
              className="rounded-[10px] bg-white px-3 py-2 text-center text-xs font-medium text-neutral-900 shadow-site-btn"
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const controls: { icon: ReactNode; label: string; detail: string; on: boolean }[] = [
  {
    icon: <IconLockFilled className="size-4 shrink-0" />,
    label: "Password protection",
    detail: "Visitors enter a password first",
    on: true,
  },
  {
    icon: <IconClockFilled className="size-4 shrink-0" />,
    label: "Expiration",
    detail: "After 1,000 clicks",
    on: true,
  },
  {
    icon: <IconMapPinFilled className="size-4 shrink-0" />,
    label: "Targeting rules",
    detail: "United States to ishortn.ink/us",
    on: true,
  },
  {
    icon: <IconCalendarFilled className="size-4 shrink-0" />,
    label: "Schedule",
    detail: "Go live at a set time",
    on: false,
  },
];

const ControlMock = () => (
  <div className="relative -mb-6 mt-2 flex flex-1 flex-col">
    <StackedPaper />
    <div className="relative flex-1 rounded-t-xl bg-white px-4 pt-4 shadow-site-card sm:px-5">
      <div className="text-sm font-semibold text-neutral-900">Link settings</div>
      <div className="mt-2 divide-y divide-neutral-950/[0.07]">
        {controls.map((c) => (
          <div key={c.label} className="flex items-center gap-3 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
              {c.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.8125rem] font-medium text-neutral-900">{c.label}</div>
              <div className="truncate text-xs text-neutral-600">{c.detail}</div>
            </div>
            <Toggle on={c.on} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ------------------------------- Content ------------------------------- */

const benefits: { title: string; body: string; mock: ReactNode }[] = [
  {
    title: "Know what works",
    body: "See clicks, unique visitors, countries, cities, devices, and referrers on a timeline. Bots and link scanners are filtered out, so the numbers are real people.",
    mock: <AnalyticsMock />,
  },
  {
    title: "Stand out with a branded link",
    body: "Swap ishortn.ink for your own domain and pick an alias people remember. Pro includes 3 custom domains. Ultra is unlimited.",
    mock: <BrandedLinkMock />,
  },
  {
    title: "One page for every link",
    body: "Build a link-in-bio page with buttons, social icons, and headings. Every block is a real short link, so each click lands in your analytics. Your first page is free.",
    mock: <BioMock />,
  },
  {
    title: "Stay in control of every link",
    body: "Lock a link behind a password, expire it by date or click count, and route visitors by country, continent, device, or OS. Password protection and targeting come with paid plans.",
    mock: <ControlMock />,
  },
];

const tiles: { label: string; icon: ReactNode }[] = [
  { label: "Click milestone alerts", icon: <IconBellFilled aria-hidden="true" /> },
  { label: "UTM templates", icon: <IconTagFilled aria-hidden="true" /> },
  { label: "Bulk CSV import", icon: <IconFileUploadFilled aria-hidden="true" /> },
  { label: "REST API", icon: <IconCodeCircleFilled aria-hidden="true" /> },
  { label: "Team workspaces", icon: <IconUserFilled aria-hidden="true" /> },
  { label: "Unsafe link scanning", icon: <IconShieldCheckFilled aria-hidden="true" /> },
  { label: "Folders and tags", icon: <IconFolderFilled aria-hidden="true" /> },
  { label: "Scheduled links", icon: <IconCalendarFilled aria-hidden="true" /> },
];

export const Features = () => (
  <Section id="features">
    <SectionHeading
      eyebrow={<Eyebrow icon={<IconSparklesFilled aria-hidden="true" />}>Benefits</Eyebrow>}
      title="Your all-purpose link platform"
      subtitle="Everything you need to shorten, brand, and measure your links. Free to start."
    />

    <dl className="mt-14 grid gap-4 lg:grid-cols-2">
      {benefits.map((b) => (
        <div key={b.title} className={cn(cardClass, "flex min-h-[30rem] flex-col overflow-hidden")}>
          <dt className={cn(h3Class, "px-6 pt-6 sm:px-8 sm:pt-8")}>{b.title}</dt>
          <dd className="flex flex-1 flex-col">
            <p className={cn(bodyClass, "mt-2 max-w-[52ch] px-6 sm:px-8")}>{b.body}</p>
            <div aria-hidden="true" className="mt-8 flex flex-1 flex-col px-6 sm:px-8">
              {b.mock}
            </div>
          </dd>
        </div>
      ))}
    </dl>

    <h2 className={cn(h2Class, "mt-24 text-center")}>…and so much more!</h2>
    <ul className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
      {tiles.map((t) => (
        <li
          key={t.label}
          className={cn(cardClass, "flex flex-col items-center gap-4 px-4 py-8 text-center")}
        >
          <IconPlate>{t.icon}</IconPlate>
          <span className="text-sm font-medium text-neutral-900">{t.label}</span>
        </li>
      ))}
    </ul>
  </Section>
);
