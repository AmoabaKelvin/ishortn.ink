import { subscribedPlan } from "@/lib/billing/entitlements";
import { subscriptionInterval } from "@/lib/billing/plans";
import { getActivePromo } from "@/lib/billing/promo";
import { api } from "@/trpc/server";

import { PricingCards } from "./_components/pricing-cards";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pricing" };

export const dynamic = "force-dynamic";

async function PricingPage() {
  const subscriptions = await api.subscriptions.get.query();
  const subscription = subscriptions.subscriptions ?? null;
  const currentInterval = subscriptionInterval(subscription);
  // A paused subscriber resumes on the plan they hold instead of starting a new checkout.
  const isPaused = subscriptions.subscriptionMode === "resume" && subscription?.status === "paused";
  // The discount code only rides on new checkouts; plan changes for subscribers are not discounted.
  const promo = subscriptions.subscriptionMode === "checkout" ? getActivePromo() : null;

  return (
    <PricingCards
      currentPlan={isPaused ? subscribedPlan(subscription) : subscriptions.plan}
      currentInterval={currentInterval}
      subscriptionMode={subscriptions.subscriptionMode}
      renewsAt={subscription?.renewsAt ?? null}
      promo={promo}
      subscription={subscription}
    />
  );
}

export default PricingPage;
