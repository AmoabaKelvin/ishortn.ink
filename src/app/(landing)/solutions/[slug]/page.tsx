import {
  IconBookFilled,
  IconBulbFilled,
  IconChevronDown,
  IconSparklesFilled,
  IconTagFilled,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { visibleRelatedLinks } from "@/lib/seo/related-links";
import { getSolution, signUpHref, solutionList } from "@/lib/seo/solutions";
import { createBreadcrumbSchema, createFaqSchema } from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { CheckList, CTA } from "../../_components/cta";
import { Faq } from "../../_components/faq";
import { Footer } from "../../_components/footer";
import { Header } from "../../_components/header";
import {
  bodyClass,
  ButtonLink,
  buttonClass,
  Eyebrow,
  h1Class,
  h3Class,
  IconPlate,
  leadClass,
  Section,
  SectionHeading,
  StepChip,
} from "../../_components/site-primitives";

import type { Metadata } from "next";

// Hourly, so a related blog post scheduled for a future date shows up on that day.
export const revalidate = 3600;

export function generateStaticParams() {
  return solutionList.map((solution) => ({ slug: solution.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) return {};

  return {
    // Absolute so the root "| iShortn" template doesn't repeat the brand already in the title.
    title: { absolute: solution.metaTitle },
    description: solution.metaDescription,
    keywords: solution.keywords,
    alternates: { canonical: `/solutions/${solution.slug}` },
    openGraph: {
      title: solution.metaTitle,
      description: solution.metaDescription,
      type: "website",
      url: `https://ishortn.ink/solutions/${solution.slug}`,
    },
  };
}

const hairline = "border-neutral-950/[0.07]";

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) return notFound();

  const related = visibleRelatedLinks(solution.related);

  return (
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "Solutions", url: "https://ishortn.ink/solutions" },
          { name: solution.name, url: `https://ishortn.ink/solutions/${solution.slug}` },
        ])}
      />
      <JsonLd data={createFaqSchema(solution.faqs)} />
      <Header />

      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<solution.icon aria-hidden="true" />}>{solution.eyebrow}</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>{solution.h1}</h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>{solution.subhead}</p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
            <ButtonLink size="lg" href={signUpHref(solution.slug, "hero")}>
              {solution.heroCta}
            </ButtonLink>
            {/* Plain anchor: an in-page jump, not a route change */}
            <a
              href="#how-it-works"
              className={buttonClass({ variant: "soft", size: "lg", arrow: true })}
            >
              How it works
              <IconChevronDown aria-hidden="true" className="size-4 shrink-0 opacity-70" />
            </a>
          </div>
          <CheckList items={solution.heroPoints} className="mt-8" />
        </div>
      </Section>

      <Section>
        <SectionHeading
          align="left"
          eyebrow={<Eyebrow icon={<IconSparklesFilled aria-hidden="true" />}>Benefits</Eyebrow>}
          title={solution.benefitsTitle}
        />
        <dl className="mt-14 grid gap-x-4 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
          {solution.benefits.map((benefit) => (
            <div key={benefit.title}>
              <dt>
                <IconPlate>
                  <benefit.icon aria-hidden="true" />
                </IconPlate>
                <span className={cn(h3Class, "mt-6 block text-balance")}>{benefit.title}</span>
              </dt>
              <dd className={cn(bodyClass, "mt-2 max-w-[56ch]")}>{benefit.body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="how-it-works">
        <SectionHeading
          align="left"
          eyebrow={<Eyebrow icon={<IconBulbFilled aria-hidden="true" />}>How it works</Eyebrow>}
          title={solution.howToTitle}
        />
        <ol className="mt-14 grid gap-x-4 gap-y-12 md:grid-cols-2 lg:grid-cols-4">
          {solution.howTo.map((step, i) => (
            <li key={step.title}>
              <StepChip>{String(i + 1).padStart(2, "0")}</StepChip>
              <h3 className={cn(h3Class, "mt-4 text-balance")}>{step.title}</h3>
              <p className={cn(bodyClass, "mt-2 max-w-[56ch]")}>{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <SectionHeading
          align="left"
          eyebrow={<Eyebrow icon={<IconTagFilled aria-hidden="true" />}>Pricing</Eyebrow>}
          title="Which plan you need"
        />
        <dl className={cn("mt-14 border-t", hairline)}>
          {solution.plans.map((plan) => (
            <div
              key={plan.plan}
              className={cn(
                "grid gap-2 border-b py-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-4",
                hairline,
              )}
            >
              <dt className={cn(h3Class, "text-balance")}>{plan.title}</dt>
              <dd className={cn(bodyClass, "max-w-[56ch]")}>{plan.body}</dd>
            </div>
          ))}
        </dl>
        {solution.plansNote && (
          <p className="mt-4 max-w-[56ch] text-pretty text-base text-neutral-600 sm:text-sm">
            {solution.plansNote}
          </p>
        )}
        <div className="mt-8">
          <ButtonLink href="/pricing" variant="secondary">
            Compare plans
          </ButtonLink>
        </div>
      </Section>

      <Faq faqs={solution.faqs.map((faq) => ({ q: faq.question, a: faq.answer }))} />

      {related.length > 0 && (
        <Section>
          <SectionHeading
            align="left"
            eyebrow={<Eyebrow icon={<IconBookFilled aria-hidden="true" />}>Guides</Eyebrow>}
            title="Related reading"
          />
          <ul className="mt-10 space-y-3">
            {related.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-pretty text-base font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <CTA
        title={solution.ctaTitle}
        body={solution.ctaBody}
        primaryHref={signUpHref(solution.slug, "cta")}
        primaryLabel={solution.ctaButton}
        points={[]}
      />
      <Footer />
    </main>
  );
}
