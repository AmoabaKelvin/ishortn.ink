import { Link } from "next-view-transitions";

import {
  testimonials as allTestimonials,
  type Testimonial as Entry,
} from "@/lib/copy/testimonials";
import { cn } from "@/lib/utils";

import { SiteIcon } from "./site-icon";
import { cardClass, Eyebrow, Section, SectionHeading } from "./site-primitives";

export const Testimonial = ({ testimonials = allTestimonials }: { testimonials?: Entry[] }) => {
  if (testimonials.length === 0) return null;
  return (
    <Section id="testimonials">
      <SectionHeading
        eyebrow={<Eyebrow icon={<SiteIcon name="message-circle-filled" />}>Testimonials</Eyebrow>}
        title="Don't just take our word for it"
      />
      <div
        className={cn(
          "mt-14 grid gap-4",
          testimonials.length === 1 ? "mx-auto max-w-3xl" : "md:grid-cols-2",
        )}
      >
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
              <blockquote className="mt-6 text-pretty font-title text-xl font-medium tracking-[-0.01em] text-neutral-900 sm:text-2xl">
                <p>{t.quote}</p>
              </blockquote>
            </div>
            <figcaption className="text-base sm:text-sm">
              <div className="font-semibold text-neutral-900">
                {t.href ? (
                  <Link href={t.href} className="hover:underline">
                    {t.name}
                  </Link>
                ) : (
                  t.name
                )}
              </div>
              <div className="mt-0.5 text-neutral-600">{t.company}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
};
