import { getIntervalFromVariantId } from "@/lib/billing/plans";
import { api } from "@/trpc/server";

import { PricingCards } from "./_components/pricing-cards";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pricing" };

export const dynamic = "force-dynamic";

async function PricingPage() {
  const subscriptions = await api.subscriptions.get.query();
  const currentInterval = getIntervalFromVariantId(subscriptions.subscriptions?.variantId);

  return (
    <PricingCards
      currentPlan={subscriptions.plan}
      currentInterval={currentInterval}
      subscriptionMode={subscriptions.subscriptionMode}
      renewsAt={subscriptions.subscriptions?.renewsAt ?? null}
    />
  );
}

export default PricingPage;
