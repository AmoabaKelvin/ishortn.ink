import { IconChevronRight, IconScaleFilled } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { JsonLd } from "@/components/seo/json-ld";
import { compareFaqs, compareIntro, compareTables, formatCheckedOn } from "@/lib/seo/compare-hub";
import { competitors } from "@/lib/seo/competitors";
import {
  createBreadcrumbSchema,
  createFaqSchema,
  createItemListSchema,
} from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { CTA } from "../_components/cta";
import { Faq } from "../_components/faq";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import {
  bodyClass,
  cardClass,
  Eyebrow,
  h1Class,
  h3Class,
  leadClass,
  Section,
  SectionHeading,
} from "../_components/site-primitives";

import type { CompareTable } from "@/lib/seo/compare-hub";
import type { Metadata } from "next";

const list = Object.values(competitors);
const names = new Intl.ListFormat("en-US", { type: "conjunction" }).format([
  "iShortn",
  ...list.map((c) => c.name),
]);
const title = "Link shortener comparison: free plans and prices";
const description = `Free-plan limits, custom domains, QR codes and prices for ${names}, side by side.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/compare" },
  openGraph: {
    title: `${title} | iShortn`,
    description,
    type: "website",
    url: "https://ishortn.ink/compare",
  },
};

const tables = compareTables();
const faqs = compareFaqs();

const toolLinkClass =
  "font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900";

function ComparisonTable({ table }: { table: CompareTable }) {
  const headingId = `compare-${table.category.replace(/\s+/g, "-").toLowerCase()}`;
  // Minimum widths keep long vendor copy from squeezing a column into a tall sliver on mobile.
  const columns = [
    { label: table.freeLinksLabel, className: "min-w-32" },
    { label: "Free analytics", className: "min-w-40" },
    { label: table.customDomainsLabel, className: "min-w-40" },
    { label: "QR codes", className: "min-w-32" },
    { label: "Paid plans", className: "min-w-56" },
    { label: "Checked", className: "whitespace-nowrap" },
  ];

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className={h3Class}>
        {table.title}
      </h2>
      <div className={cn(cardClass, "mt-5 overflow-x-auto")}>
        <table className="w-full border-collapse text-left text-base sm:text-sm">
          <caption className="sr-only">{table.caption}</caption>
          <thead>
            <tr className="border-b border-neutral-950/[0.07]">
              <th
                scope="col"
                className="sticky left-0 min-w-28 bg-white px-4 py-4 sm:px-5 font-medium text-neutral-600"
              >
                Tool
              </th>
              {columns.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={cn("px-4 py-4 sm:px-5 font-medium text-neutral-600", column.className)}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-950/[0.07]">
            {table.rows.map((row) => {
              const isIshortn = row.isOwn;
              const cellClass = cn(
                "px-4 py-4 sm:px-5 align-top",
                isIshortn ? "bg-neutral-50 text-neutral-900" : "text-neutral-600",
              );
              return (
                <tr key={row.name}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 px-4 py-4 sm:px-5 align-top",
                      isIshortn ? "bg-neutral-50" : "bg-white",
                    )}
                  >
                    <Link href={row.href} className={toolLinkClass}>
                      {row.name}
                    </Link>
                  </th>
                  <td className={cellClass}>{row.freeLinks}</td>
                  <td className={cellClass}>{row.freeAnalytics}</td>
                  <td className={cellClass}>{row.customDomains}</td>
                  <td className={cellClass}>{row.qrCodes}</td>
                  <td className={cellClass}>{row.pricing}</td>
                  <td className={cn(cellClass, "whitespace-nowrap tabular-nums")}>
                    {row.checkedOn ? (
                      <time dateTime={row.checkedOn}>{formatCheckedOn(row.checkedOn)}</time>
                    ) : (
                      "Live"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function CompareHubPage() {
  return (
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "Compare", url: "https://ishortn.ink/compare" },
        ])}
      />
      <JsonLd data={createFaqSchema(faqs)} />
      <JsonLd
        data={createItemListSchema(
          list.map((c) => ({
            name: `iShortn vs ${c.name}`,
            url: `https://ishortn.ink/compare/${c.slug}`,
          })),
        )}
      />
      <Header />

      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconScaleFilled aria-hidden="true" />}>Compare</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>
            Link shorteners compared: free plans and prices
          </h1>
          <p className={cn(leadClass, "mt-5 max-w-[60ch]")}>{compareIntro()}</p>
          <p className={cn(bodyClass, "mt-4 max-w-[60ch]")}>
            Want to self-host? See{" "}
            <Link href="/open-source-url-shortener" className={toolLinkClass}>
              open-source URL shorteners compared
            </Link>
            .
          </p>
        </div>
      </Section>

      <Section>
        <div className="space-y-14">
          {tables.map((table) => (
            <ComparisonTable key={table.category} table={table} />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading title="Full comparisons" />
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((competitor) => (
            <li key={competitor.slug} className="flex">
              <Link
                href={`/compare/${competitor.slug}`}
                className={cn(cardClass, "flex w-full flex-col p-6 hover:bg-neutral-50")}
              >
                <h3 className={cn(h3Class, "text-balance")}>iShortn vs {competitor.name}</h3>
                <p className={cn(bodyClass, "mt-2")}>{competitor.tagline}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-medium text-neutral-900">
                  See comparison
                  <IconChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-70" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Faq
        faqs={faqs.map((f) => ({ q: f.question, a: f.answer }))}
        title="Questions"
        subtitle="Competitor answers use each company's own pricing page."
      />

      <CTA />
      <Footer />
    </main>
  );
}
