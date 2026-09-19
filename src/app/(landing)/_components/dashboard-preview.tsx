import { IconChartAreaLineFilled, IconChevronDown } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import { ButtonLink, Eyebrow, panelClass, Section, SectionHeading } from "./site-primitives";

const stats = [
  { label: "Clicks", value: "24,847" },
  { label: "Unique visitors", value: "18,209" },
  { label: "Top country", value: "United States" },
];

const topLinks = [
  { alias: "ishortn.ink/launch", destination: "yourbrand.com/launch", clicks: "8,412" },
  {
    alias: "ishortn.ink/sale",
    destination: "yourbrand.com/collections/summer-sale",
    clicks: "5,120",
  },
  { alias: "ishortn.ink/news", destination: "yourbrand.com/newsletter", clicks: "3,876" },
  { alias: "ishortn.ink/docs", destination: "docs.yourbrand.com/start", clicks: "2,045" },
  { alias: "ishortn.ink/demo", destination: "yourbrand.com/book-a-demo", clicks: "1,394" },
];

// Clicks over time, y in a 0-100 box (0 = top)
const line = "0,78 8,70 16,74 24,58 32,62 40,44 48,50 56,36 64,40 72,24 80,30 88,16 100,20";

const AnalyticsMock = () => (
  <div className="rounded-tl-xl bg-neutral-50 p-4 shadow-site-card sm:p-5">
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-semibold text-neutral-900">Analytics</div>
      <div className="flex items-center gap-2 rounded-[10px] bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 shadow-site-btn">
        Last 30 days
        <IconChevronDown className="size-4 shrink-0 text-neutral-500" />
      </div>
    </div>

    <div className="mt-4 grid grid-cols-3 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl bg-white p-3 shadow-site-card">
          <div className="text-xs text-neutral-600">{s.label}</div>
          <div className="mt-1 truncate font-title text-lg font-semibold tracking-tight text-neutral-900">
            {s.value}
          </div>
        </div>
      ))}
    </div>

    <div className="mt-3 rounded-xl bg-white p-4 shadow-site-card">
      <div className="text-xs font-medium text-neutral-600">Clicks over time</div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-3 block h-32 w-full">
        <polygon points={`0,100 ${line} 100,100`} className="fill-emerald-500/10" />
        <polyline
          points={line}
          fill="none"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className="stroke-emerald-500"
        />
      </svg>
    </div>

    <div className="mt-3 rounded-xl bg-white shadow-site-card">
      <div className="flex justify-between px-4 pb-2 pt-3 text-xs font-medium text-neutral-600">
        <span>Top links</span>
        <span>Clicks</span>
      </div>
      <div className="divide-y divide-neutral-950/[0.07] border-t border-neutral-950/[0.07]">
        {topLinks.map((l) => (
          <div key={l.alias} className="flex items-center gap-4 px-4 py-2.5 text-xs">
            <span className="shrink-0 font-mono text-neutral-900">{l.alias}</span>
            <span className="min-w-0 flex-1 truncate text-neutral-600">{l.destination}</span>
            <span className="shrink-0 font-medium tabular-nums text-neutral-900">{l.clicks}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const DashboardPreview = () => (
  <Section className="px-3 py-3 sm:px-3 sm:py-3 xl:px-3">
    <div className={cn(panelClass, "relative overflow-hidden px-8 py-14 sm:px-14 sm:py-20")}>
      <div className="lg:w-1/2 lg:pr-8">
        <SectionHeading
          align="left"
          eyebrow={
            <Eyebrow icon={<IconChartAreaLineFilled aria-hidden="true" />}>Analytics</Eyebrow>
          }
          title="Know who clicked, where, and when"
          subtitle="Every short link comes with its own dashboard. No extra setup."
          actions={
            <ButtonLink variant="secondary" href="/features">
              See all features
            </ButtonLink>
          }
        />
      </div>

      {/* Bleeds off the panel's right and bottom edges; the panel clips it. */}
      <div
        aria-hidden="true"
        className="-mb-14 -mr-8 mt-12 h-80 sm:-mb-20 sm:-mr-14 lg:absolute lg:left-1/2 lg:top-16 lg:m-0 lg:h-auto lg:w-[44rem]"
      >
        <div className="w-[36rem] lg:w-auto">
          <AnalyticsMock />
        </div>
      </div>
    </div>
  </Section>
);
