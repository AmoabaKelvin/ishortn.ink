import { describe, expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { SidebarStats } from "@/app/(main)/dashboard/_components/navigation/sidebar-stats";
import {
  PromoOfferSuffix,
  UpgradeOfferProvider,
} from "@/app/(main)/dashboard/_components/upgrade-offer";
import { RangeSelector } from "@/app/(main)/dashboard/analytics/[alias]/_components/range-selector";
import { LimitedAnalyticsNotice } from "@/app/(main)/dashboard/analytics/_components/limited-analytics-notice";
import { EmptyStateFree } from "@/app/(main)/dashboard/folders/_components/empty-state-free";
import UpgradeText from "@/app/(main)/dashboard/qrcodes/_components/upgrade-text";
import {
  ApiKeySunsetNotice,
  ApiProGate,
} from "@/app/(main)/dashboard/settings/tokens/_components/api-access-notice";
import { ACTIVE_PROMO } from "@/lib/billing/promo";
import { TRPCReactProvider } from "@/trpc/react";

import { UpgradeCta } from "./upgrade-cta";

import type { ReactNode } from "react";

// Static render: hooks resolve against the real provider, effects (and so the
// recordView mutation) never run.
const render = (node: ReactNode) =>
  renderToStaticMarkup(<TRPCReactProvider>{node}</TRPCReactProvider>);

const hrefs = (html: string) =>
  [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]!.replaceAll("&amp;", "&"));

describe("UpgradeCta", () => {
  test("links to pricing with the required plan and source", () => {
    const html = render(
      <UpgradeCta requiredPlan="ultra" source="teams" className="x">
        Upgrade
      </UpgradeCta>,
    );
    expect(hrefs(html)).toEqual(["/dashboard/pricing?highlight=ultra&source=teams"]);
    expect(html).toContain('class="x"');
  });
});

describe("plan gates render the shared CTA", () => {
  test("folders empty state", () => {
    expect(hrefs(render(<EmptyStateFree />))).toEqual([
      "/dashboard/pricing?highlight=pro&source=folders",
    ]);
  });

  test("API access gate and sunset notice", () => {
    expect(hrefs(render(<ApiProGate />))).toEqual([
      "/dashboard/pricing?highlight=pro&source=api_access",
    ]);
    expect(
      hrefs(
        render(
          <ApiKeySunsetNotice
            access={{ status: "revoked", deprecatedAt: new Date(), sunsetAt: new Date() }}
          />,
        ),
      ),
    ).toEqual(["/dashboard/pricing?highlight=pro&source=api_access"]);
  });

  test("inline upgrade text", () => {
    expect(hrefs(render(<UpgradeText text="Upgrade" source="qr_create_limit" />))).toEqual([
      "/dashboard/pricing?highlight=pro&source=qr_create_limit",
    ]);
  });

  test("analytics range picker carries the locked-range CTA for free plans only", () => {
    const free = render(<RangeSelector isProPlan={false} value="7d" onRangeChange={() => {}} />);
    expect(hrefs(free)).toEqual(["/dashboard/pricing?highlight=pro&source=analytics_range"]);
    expect(free).toContain("Pro shows your full history");

    const pro = render(<RangeSelector isProPlan value="30d" onRangeChange={() => {}} />);
    expect(hrefs(pro)).toEqual([]);
  });
});

describe("promo offer in upgrade prompts", () => {
  const withPromo = (node: ReactNode) =>
    render(<UpgradeOfferProvider promo={ACTIVE_PROMO}>{node}</UpgradeOfferProvider>);
  const utm = "&utm_source=app&utm_medium=upgrade_prompt&utm_campaign=bfcm2026";
  const offerTitle = "Black Friday: 20% off Pro";
  const offerPrice = "$5.33/mo for your first year, billed yearly. Ends Tue 1 Dec.";
  const offerLine = "Black Friday: Pro is 20% off your first year until Tuesday 1 December.";

  const freeSidebar = (monthlyLinkCount: number) => (
    <SidebarStats
      monthlyLinkCount={monthlyLinkCount}
      userHasPaidPlan={false}
      linkLimit={30}
      plan="free"
      shown
    />
  );

  test("the Free sidebar CTA shows the first-year price only with a promo", () => {
    const plain = render(freeSidebar(3));
    expect(plain).not.toContain(offerTitle);
    expect(hrefs(plain)).toEqual(["/dashboard/pricing?highlight=pro&source=sidebar_free"]);

    const offer = withPromo(freeSidebar(3));
    // React splits adjacent text nodes with comments in static markup.
    const text = offer.replaceAll("<!-- -->", "");
    expect(text).toContain(offerTitle);
    expect(text).toContain(offerPrice);
    expect(text).toContain("Upgrade to Pro");
    expect(hrefs(offer)).toEqual([
      `/dashboard/pricing?highlight=pro&source=sidebar_free${utm}&utm_content=sidebar_free`,
    ]);

    expect(hrefs(withPromo(freeSidebar(30)))).toEqual([
      `/dashboard/pricing?highlight=pro&source=sidebar_free_at_limit${utm}&utm_content=sidebar_free_at_limit`,
    ]);
  });

  test("the Free sidebar CTA quotes the usage reason with its own source", () => {
    const visits = render(
      <SidebarStats
        monthlyLinkCount={3}
        userHasPaidPlan={false}
        linkLimit={30}
        eventUsage={{ count: 720, limit: 1000 }}
        qrCodeUsage={{ count: 5, limit: 5 }}
        plan="free"
        shown
      />,
    );
    expect(visits).toContain("720/1,000 tracked clicks used");
    expect(hrefs(visits)).toEqual(["/dashboard/pricing?highlight=pro&source=sidebar_visits_cap"]);

    const qr = render(
      <SidebarStats
        monthlyLinkCount={3}
        userHasPaidPlan={false}
        linkLimit={30}
        qrCodeUsage={{ count: 5, limit: 5 }}
        plan="free"
        shown
      />,
    );
    expect(qr).toContain("5/5 QR codes used");
    expect(hrefs(qr)).toEqual(["/dashboard/pricing?highlight=pro&source=sidebar_qr_cap"]);
  });

  test("the Pro sidebar CTA never shows the offer", () => {
    const html = withPromo(
      <SidebarStats monthlyLinkCount={3} userHasPaidPlan linkLimit={null} plan="pro" shown />,
    );
    expect(html.replaceAll("<!-- -->", "")).not.toContain(offerTitle);
    expect(hrefs(html)).toEqual(["/dashboard/pricing?highlight=ultra&source=sidebar_pro"]);
  });

  test("inline upgrade text gets the offer sentence and UTMs only with a promo", () => {
    const sentence = (
      <p>
        Viewing limited analytics (last 7 days).{" "}
        <UpgradeText text="Upgrade to Pro" source="link_analytics" /> for full data.
        <PromoOfferSuffix />
      </p>
    );
    const plain = render(sentence);
    expect(plain).not.toContain(offerLine);
    expect(hrefs(plain)).toEqual(["/dashboard/pricing?highlight=pro&source=link_analytics"]);

    const offer = withPromo(sentence);
    expect(offer).toContain(offerLine);
    expect(hrefs(offer)).toEqual([
      `/dashboard/pricing?highlight=pro&source=link_analytics${utm}&utm_content=link_analytics`,
    ]);
  });

  test("the Free analytics notice names the hidden clicks, then the offer", () => {
    const html = withPromo(<LimitedAnalyticsNotice hiddenClicks={1284} source="link_analytics" />);
    const text = html.replace(/<[^>]+>/g, "");
    expect(text).toBe(
      `1,284 older clicks are hidden on Free (last 7 days shown). Upgrade to Pro to see all of them. ${offerLine}`,
    );
    expect(hrefs(html)).toEqual([
      `/dashboard/pricing?highlight=pro&source=link_analytics${utm}&utm_content=link_analytics`,
    ]);

    const none = render(<LimitedAnalyticsNotice hiddenClicks={0} source="analytics_overview" />);
    expect(none.replace(/<[^>]+>/g, "")).toBe(
      "Viewing limited analytics (last 7 days). Upgrade to Pro for full data.",
    );
  });
});
