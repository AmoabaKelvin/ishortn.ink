import { IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";

import {
  testimonials as allTestimonials,
  type Testimonial as Entry,
} from "@/lib/copy/testimonials";
import { cn } from "@/lib/utils";

import { SiteIcon } from "./site-icon";
import { cardClass, Eyebrow, Section, SectionHeading } from "./site-primitives";

export const Testimonial = ({ testimonials = allTestimonials }: { testimonials?: Entry[] }) => {
  if (testimonials.length === 0) return null;
  const single = testimonials.length === 1;
  return (
    <Section id="testimonials">
      <SectionHeading
        eyebrow={<Eyebrow icon={<SiteIcon name="message-circle-filled" />}>Testimonials</Eyebrow>}
        title="Don't just take our word for it"
      />
      <div className={cn("mt-14 grid gap-4", single ? "mx-auto max-w-3xl" : "md:grid-cols-2")}>
        {testimonials.map((t) => (
          <figure
            key={t.id}
            className={cn(cardClass, "flex flex-col justify-between gap-8 p-6 sm:p-10")}
          >
            <div>
              <SiteIcon
                name="quote-filled"
                className="size-10 shrink-0 rotate-180 text-neutral-900"
              />
              {/* Half-width cards keep the smaller size so long quotes stay readable */}
              <blockquote
                className={cn(
                  "mt-6 text-pretty font-title text-xl font-medium tracking-[-0.01em] text-neutral-900",
                  single && "sm:text-2xl",
                )}
              >
                <p>{t.quote}</p>
              </blockquote>
            </div>
            <figcaption className="flex items-center justify-between gap-4 text-base sm:text-sm">
              <div className="min-w-0">
                <div className="font-semibold text-neutral-900">{t.name}</div>
                <div className="mt-0.5 text-neutral-600">
                  {t.role ? `${t.role}, ${t.company}` : t.company}
                </div>
                {t.href && (
                  <Link
                    href={t.href}
                    className="mt-3 inline-flex items-center gap-0.5 font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900"
                  >
                    Read the story<span className="sr-only"> of {t.company}</span>
                    <IconChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-70" />
                  </Link>
                )}
              </div>
              {t.logo && (
                // oxlint-disable-next-line nextjs/no-img-element -- static SVG; the Worker has no image optimizer
                <img
                  src={t.logo}
                  alt={t.company}
                  width={85}
                  height={28}
                  className="h-7 w-auto shrink-0"
                  loading="lazy"
                />
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
};
