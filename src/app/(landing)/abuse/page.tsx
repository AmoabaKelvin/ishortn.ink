import { IconFlagFilled } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { Eyebrow, h1Class, leadClass, Section } from "../_components/site-primitives";
import { AbuseReportForm } from "./abuse-report-form";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Report Abuse - iShortn",
  description:
    "Report a short link that is being used for phishing, malware, spam, or other abuse. iShortn reviews every report and acts on links that violate our policies.",
  openGraph: {
    title: "Report Abuse - iShortn",
    description:
      "Report a short link that is being used for phishing, malware, spam, or other abuse.",
    type: "website",
  },
};

export default function AbusePage() {
  return (
    <main>
      <Header />

      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconFlagFilled aria-hidden="true" />}>Trust &amp; safety</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>Report a link that breaks the rules</h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
            Tell us about a short link used for phishing, malware, spam, or impersonation, and we
            will review it and disable links that violate our policies.
          </p>
        </div>
      </Section>

      <Section className="py-16 sm:py-20">
        <AbuseReportForm />
        <p className="mx-auto mt-6 max-w-xl text-pretty text-center text-base text-neutral-600 sm:text-sm">
          For urgent legal matters, you can also reach us at{" "}
          <a
            href="mailto:support@ishortn.ink"
            className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900"
          >
            support@ishortn.ink
          </a>
          .
        </p>
      </Section>

      <Footer />
    </main>
  );
}
