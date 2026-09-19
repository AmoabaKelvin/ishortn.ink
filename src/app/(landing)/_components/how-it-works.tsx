import {
  IconArrowNarrowDown,
  IconBrandInstagram,
  IconBrandWhatsapp,
  IconBrandX,
  IconBulbFilled,
  IconCopy,
  IconLink,
  IconMail,
  IconQrcode,
  IconSelector,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import {
  bodyClass,
  cardClass,
  Eyebrow,
  h3Class,
  Section,
  SectionHeading,
  StepChip,
  Wordmark,
} from "./site-primitives";

import type { ReactNode } from "react";

const hairline = "border-neutral-950/[0.07]";

/* 01: long URL collapses into a short link */
const PasteMock = () => (
  <div aria-hidden="true" className="flex h-64 flex-col items-center px-6 pt-2 sm:px-7">
    <div className="w-full truncate rounded-[10px] bg-white px-3 py-2.5 font-mono text-xs text-neutral-500 shadow-site-btn">
      https://acme.com/blog/2026/product-launch-announcement?ref=newsletter
    </div>
    <span className="my-3 grid size-7 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-600">
      <IconArrowNarrowDown className="size-4" />
    </span>
    <div className="w-full flex-1 rounded-t-xl bg-white p-4 shadow-site-card">
      <div className="flex items-center gap-2">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
          <IconLink className="size-3" />
        </span>
        <span className="min-w-0 truncate font-mono text-sm font-medium text-neutral-900">
          ishortn.ink/launch
        </span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-1 text-xs font-medium text-neutral-700">
          <IconCopy className="size-3.5" />
          Copy
        </span>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2 w-3/4 rounded-full bg-neutral-100" />
        <div className="h-2 w-1/2 rounded-full bg-neutral-100" />
      </div>
    </div>
  </div>
);

/* 02: stacked-paper link settings, one active row */
const Toggle = () => (
  <span className="flex h-4 w-7 shrink-0 items-center rounded-full bg-neutral-200 px-0.5">
    <span className="size-3 rounded-full bg-white shadow-sm" />
  </span>
);

const SettingRow = ({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "flex items-center justify-between gap-3 border-t px-4 py-3.5 first:border-t-0",
      hairline,
      !active && "opacity-40",
    )}
  >
    <span className="shrink-0 text-[0.8125rem] font-medium text-neutral-900">{label}</span>
    {children}
  </div>
);

const SettingsMock = () => (
  <div aria-hidden="true" className="h-64 px-6 pt-4 sm:px-7">
    <div className="relative">
      <div className="absolute inset-x-4 -top-2 h-4 rounded-t-xl bg-white shadow-site-card" />
      <div className="relative rounded-t-xl bg-white shadow-site-card">
        <SettingRow label="Custom alias" active>
          <span className="min-w-0 truncate rounded-md bg-white px-2 py-1 font-mono text-xs text-neutral-500 shadow-site-btn">
            ishortn.ink/<span className="font-medium text-neutral-900">launch</span>
          </span>
        </SettingRow>
        <SettingRow label="Domain">
          <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-white py-1 pl-2 pr-1 font-mono text-xs text-neutral-700 shadow-site-btn">
            <span className="truncate">ishortn.ink</span>
            <IconSelector className="size-3.5 shrink-0" />
          </span>
        </SettingRow>
        <SettingRow label="Expire after date">
          <Toggle />
        </SettingRow>
        <SettingRow label="Password protection">
          <Toggle />
        </SettingRow>
        <SettingRow label="Disable after clicks">
          <Toggle />
        </SettingRow>
      </div>
    </div>
  </div>
);

/* 03: share channels orbiting the wordmark */
const ring =
  "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-neutral-950/[0.07]";

// Offsets sit on the 80px and 135px orbits. Full class strings so Tailwind can see them.
const channels = [
  { icon: IconBrandWhatsapp, pos: "left-[calc(50%-27px)] top-[calc(50%-75px)]" },
  { icon: IconMail, pos: "left-[calc(50%+14px)] top-[calc(50%+79px)]" },
  { icon: IconBrandX, pos: "left-[calc(50%+117px)] top-[calc(50%-68px)]" },
  { icon: IconBrandInstagram, pos: "left-[calc(50%-130px)] top-[calc(50%+35px)]" },
  { icon: IconQrcode, pos: "left-[calc(50%+111px)] top-[calc(50%+77px)]" },
];

const OrbitMock = () => (
  <div aria-hidden="true" className="relative h-64">
    <span className={cn(ring, "size-[160px]")} />
    <span className={cn(ring, "size-[270px]")} />
    <span className={cn(ring, "size-[390px]")} />
    {channels.map(({ icon: ChannelIcon, pos }) => (
      <span
        key={pos}
        className={cn(
          "absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-neutral-700 shadow-site-card",
          pos,
        )}
      >
        <ChannelIcon className="size-[18px]" />
      </span>
    ))}
    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white px-3 py-1.5 shadow-site-card">
      <Wordmark className="text-base [&>svg]:size-5" />
    </span>
  </div>
);

const steps = [
  {
    title: "Paste your link",
    body: "Drop in any long URL and get a short ishortn.ink link back in a second.",
    mock: <PasteMock />,
  },
  {
    title: "Make it yours",
    body: "Pick a custom alias, use your own domain, set an expiry, or add a password.",
    mock: <SettingsMock />,
  },
  {
    title: "Share and track",
    body: "Post it anywhere or print the QR code, then watch the clicks come in.",
    mock: <OrbitMock />,
  },
];

export const HowItWorks = () => (
  <Section id="how-it-works">
    <SectionHeading
      eyebrow={<Eyebrow icon={<IconBulbFilled aria-hidden="true" />}>How it works</Eyebrow>}
      title="With us, link management is easy"
      subtitle="Three steps from a long URL to a link you can track."
    />

    <ol className="mt-14 grid gap-4 lg:grid-cols-3">
      {steps.map((step, i) => (
        <li key={step.title} className={cn(cardClass, "flex min-w-0 flex-col overflow-hidden")}>
          <div className="p-6 sm:p-7">
            <StepChip>{String(i + 1).padStart(2, "0")}</StepChip>
            <h3 className={cn(h3Class, "mt-5")}>{step.title}</h3>
            <p className={cn(bodyClass, "mt-2")}>{step.body}</p>
          </div>
          <div className="mt-auto">{step.mock}</div>
        </li>
      ))}
    </ol>
  </Section>
);
