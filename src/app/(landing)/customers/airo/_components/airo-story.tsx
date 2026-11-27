import { testimonials } from "@/lib/copy/testimonials";
import { cn } from "@/lib/utils";

import { SiteIcon } from "../../../_components/site-icon";
import { cardClass, h1Class, leadClass, Section } from "../../../_components/site-primitives";

// The closing pull quote is the testimonial shown on the home and pricing pages.
const quote = testimonials.find((t) => t.id === "chris-lastra-airo");

/** The customer-approved story, hero to pull quote. Copy is final: don't reword it. */
export const AiroStory = () => (
  <>
    <Section className="py-16 sm:py-24">
      <div className="flex flex-col items-center text-center">
        {/* oxlint-disable-next-line nextjs/no-img-element -- static SVG; the Worker has no image optimizer */}
        <img
          src="/images/customers/airo.svg"
          alt="AIRO"
          width={109}
          height={36}
          className="h-9 w-auto"
        />
        <h1 className={cn(h1Class, "mt-8 max-w-[22ch]")}>
          AIRO stopped guessing which marketing works. Then they stopped paying for rack cards.
        </h1>
        <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
          Customer story: AIRO, Missouri and Arkansas
        </p>
      </div>
    </Section>
    <Section className="py-16 sm:py-20">
      <article>
        <div className="site-prose mx-auto">
          <p>
            AIRO is an aviation company that offers helicopter tours, charter flights and flight
            training in Missouri and Arkansas. Chris Lastra, AIRO&apos;s Marketing Manager, runs
            marketing for four markets with a small team, and each market has its own limited
            budget. AIRO has been on iShortn Pro for more than a year.
          </p>

          <h2>The challenge</h2>
          <p>
            Before iShortn, AIRO used direct links, or links with UTM codes. &ldquo;They were
            difficult to keep track of,&rdquo; Chris says.
          </p>
          <p>
            The bigger problem was arguments without evidence. Managers and outside partners would
            tell Chris that a platform or campaign was doing good numbers for them. &ldquo;I had no
            proof to back it up,&rdquo; he says.
          </p>
          <p>
            AIRO needed tracking it could trust, but not a full enterprise product built for much
            bigger companies. &ldquo;This made sense to us at its price point,&rdquo; Chris says of
            iShortn.
          </p>

          <h2>How AIRO uses iShortn</h2>
          <p>
            In a normal week, AIRO uses iShortn to track and validate traffic from different
            sources. The team uses the tracking to see how well each partner and vertical is
            performing.
          </p>
          <p>
            The partner deals in Branson show how this works. &ldquo;We might allow them to offer
            exclusive discounts but we expect a certain number of visits or conversions in
            turn,&rdquo; Chris explains. The click data shows whether the partner holds up its end.
          </p>
          <p>
            The feature Chris relies on most is analytics, &ldquo;especially this time of
            year.&rdquo; The numbers he checks are plain ones. &ldquo;Seeing clicks and unique
            visitors is the bread and butter.&rdquo;
          </p>

          <h2>The result</h2>
          <p>
            Those debates with managers and partners now end with data. &ldquo;Now I can show them
            what really is and is not working so we&apos;re not relying on vibes to drive spending
            choices,&rdquo; Chris says.
          </p>
          <p>
            The latest decision was about rack cards, the printed brochures that sit in display
            racks. The numbers showed they weren&apos;t earning their place, so AIRO stopped using
            them in its Branson and Lake Ozark markets. &ldquo;That is going to be a few thousand
            dollars saved in both markets on spend that just wasn&apos;t working,&rdquo; Chris says.
            After checking the invoices, AIRO is cancelling at least $5,000 in rack card spend for
            next year.
          </p>
          <p>
            AIRO is using the same data right now to re-evaluate its entire marketing spend for
            2027.
          </p>
          <p>
            There&apos;s a benefit for the team as well. &ldquo;As a manager, I also like using it
            because it allows me to credit my team&apos;s hard work with real numbers.&rdquo;
          </p>

          <h2>Who Chris would recommend it to</h2>
          <p>
            &ldquo;I would easily recommend this to small marketing teams looking for an easy and
            inexpensive way to optimize their spending or prove whether a strategy is
            working.&rdquo;
          </p>

          <h2>In his words</h2>
        </div>

        {quote && (
          <figure
            className={cn(cardClass, "mx-auto mt-6 flex max-w-[70ch] flex-col gap-8 p-6 sm:p-10")}
          >
            <SiteIcon
              name="quote-filled"
              className="size-10 shrink-0 rotate-180 text-neutral-900"
            />
            <blockquote className="text-pretty font-title text-xl font-medium tracking-[-0.01em] text-neutral-900 sm:text-2xl">
              <p>&ldquo;{quote.quote}&rdquo;</p>
            </blockquote>
            <figcaption className="flex items-center justify-between gap-4 text-base sm:text-sm">
              <div className="min-w-0">
                <div className="font-semibold text-neutral-900">{quote.name}</div>
                <div className="mt-0.5 text-neutral-600">
                  {quote.role}, {quote.company}
                </div>
              </div>
              {quote.logo && (
                // oxlint-disable-next-line nextjs/no-img-element -- static SVG; the Worker has no image optimizer
                <img
                  src={quote.logo}
                  alt=""
                  width={85}
                  height={28}
                  className="h-7 w-auto shrink-0"
                  loading="lazy"
                />
              )}
            </figcaption>
          </figure>
        )}
      </article>
    </Section>{" "}
  </>
);
