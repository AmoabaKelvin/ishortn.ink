import { api } from "@/trpc/server";

import { PricingCards } from "./_components/pricing-cards";

export const dynamic = "force-dynamic";

async function PricingPage() {
  const subscriptions = await api.subscriptions.get.query();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PricingCards currentPlan={subscriptions.plan} />
    </div>
  );
}

export default PricingPage;
