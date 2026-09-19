import { IconUserFilled } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import { cardClass, Eyebrow, Section, SectionHeading } from "./site-primitives";

const quotes = [
  {
    q: "This tool is a godsend. I am using the link shortener and the QR code generator. It does everything I need it to.",
    name: "FixatedManufacturing",
    role: "Small Business Owner",
  },
  {
    q: "We pasted posters around town using the QR codes and now we know which ones perform best. It has really helped us grow.",
    name: "Plamagandalla",
    role: "Marketing Team",
  },
  {
    q: "Looks awesome. Minimalist and accurate. Exactly what I was looking for. Clean interface, fast redirects, and the analytics are spot on.",
    name: "Anonymous",
    role: "Developer",
  },
  {
    q: "The QR codes look great on our packaging. Finally something I'm not embarrassed to print.",
    name: "Sachi Tanaka",
    role: "Founder, Fieldnotes",
  },
  {
    q: "Switched from Bitly in ten minutes. My links are mine again, and they look nice now.",
    name: "Devon Park",
    role: "Indie maker",
  },
];

export const Testimonials = () => (
  <Section id="stories">
    <SectionHeading
      eyebrow={<Eyebrow icon={<IconUserFilled aria-hidden="true" />}>Testimonials</Eyebrow>}
      title="Don't just take our word for it"
      subtitle="Our users are our best ambassadors. See why they chose iShortn."
    />

    {/* ponytail: native scroll-snap row, no carousel lib. Active-card fade and "+" corner marks need JS; add if wanted. */}
    <div className="-mx-5 mt-14 border-y border-neutral-950/[0.07] py-4 sm:-mx-8 xl:-mx-16">
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 py-1 [mask-image:linear-gradient(to_right,transparent,#000_5%,#000_95%,transparent)] [scrollbar-width:none] sm:px-8 xl:px-16 [&::-webkit-scrollbar]:hidden">
        {quotes.map((t) => (
          <figure
            key={t.name}
            className={cn(
              cardClass,
              "flex min-h-[17rem] w-[85vw] max-w-[32.5rem] shrink-0 snap-center flex-col justify-between gap-8 p-7",
            )}
          >
            <blockquote className="text-pretty indent-[-0.4em] font-title text-2xl font-semibold tracking-tight text-neutral-900">
              &quot;{t.q}&quot;
            </blockquote>
            <figcaption className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-lg bg-neutral-100 font-title text-base font-semibold text-neutral-700 outline outline-1 -outline-offset-1 outline-black/5"
              >
                {t.name[0]}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-neutral-900">
                  {t.name}
                </span>
                <span className="block truncate text-sm text-neutral-600">{t.role}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  </Section>
);
