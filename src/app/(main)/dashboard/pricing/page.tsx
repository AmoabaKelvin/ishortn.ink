import { getIntervalFromVariantId } from "@/lib/billing/plans";
import { getActivePromo } from "@/lib/billing/promo";
import { api } from "@/trpc/server";

import { PricingCards } from "./_components/pricing-cards";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pricing" };

export const dynamic = "force-dynamic";

async function PricingPage() {
  const subscriptions = await api.subscriptions.get.query();
  const currentInterval = getIntervalFromVariantId(subscriptions.subscriptions?.variantId);
  // The discount code only rides on new checkouts; plan changes for subscribers are not discounted.
  const promo = subscriptions.subscriptionMode === "checkout" ? getActivePromo() : null;

  return (
    <PricingCards
      currentPlan={subscriptions.plan}
      currentInterval={currentInterval}
      subscriptionMode={subscriptions.subscriptionMode}
      renewsAt={subscriptions.subscriptions?.renewsAt ?? null}
      promo={promo}
    />
  );
}

export default PricingPage;
