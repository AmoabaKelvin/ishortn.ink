import { landingPageCopy } from "@/lib/copy/landing-page";

import { SiteIcon } from "./site-icon";
import { Eyebrow, Section, SectionHeading } from "./site-primitives";

type FaqEntry = { q: string; a: string };

// Same source as the homepage FAQ JSON-LD, so the schema matches what's on the page.
const defaultFaqs: FaqEntry[] = landingPageCopy.faq.map((f) => ({ q: f.question, a: f.answer }));

export const Faq = ({
  faqs = defaultFaqs,
  eyebrow = "FAQ",
  title = "Frequently asked questions",
  subtitle = "These are the questions we hear most.",
}: {
  faqs?: FaqEntry[];
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}) => (
  <Section id="help">
    <SectionHeading
      eyebrow={<Eyebrow icon={<SiteIcon name="help-circle-filled" />}>{eyebrow}</Eyebrow>}
      title={title}
      subtitle={subtitle}
    />

    <div className="mx-auto mt-14 max-w-4xl border-t border-neutral-950/[0.07]">
      {faqs.map((it, i) => (
        <details
          key={it.q}
          name="faq"
          open={i === 0}
          className="group border-b border-neutral-950/[0.07]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-sm py-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 [&::-webkit-details-marker]:hidden">
            <span className="font-title text-lg font-semibold tracking-[-0.01em] text-neutral-900">
              {it.q}
            </span>
            <SiteIcon
              name="plus"
              className="size-5 shrink-0 text-neutral-600 transition-transform group-open:rotate-45 motion-reduce:transition-none"
            />
          </summary>
          <p className="max-w-[70ch] text-pretty pb-6 pr-10 text-base text-neutral-600">{it.a}</p>
        </details>
      ))}
    </div>
  </Section>
);
