import { describe, expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { RangeSelector } from "@/app/(main)/dashboard/analytics/[alias]/_components/range-selector";
import { EmptyStateFree } from "@/app/(main)/dashboard/folders/_components/empty-state-free";
import UpgradeText from "@/app/(main)/dashboard/qrcodes/_components/upgrade-text";
import {
  ApiKeySunsetNotice,
  ApiProGate,
} from "@/app/(main)/dashboard/settings/tokens/_components/api-access-notice";
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
