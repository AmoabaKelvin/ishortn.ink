import { api } from "@/trpc/server";

import { CampaignsList } from "./_components/campaigns-list";

export const dynamic = "force-dynamic";

async function CampaignsPage() {
  const [campaigns, sub] = await Promise.all([
    api.campaign.list.query({ status: "all" }),
    api.subscriptions.get.query(),
  ]);

  return (
    <CampaignsList
      campaigns={campaigns}
      plan={sub.plan}
      campaignLimit={sub.caps.campaignLimit ?? null}
    />
  );
}

export default CampaignsPage;
