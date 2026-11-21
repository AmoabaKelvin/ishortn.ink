import { api } from "@/trpc/server";

import { CampaignsList } from "./_components/campaigns-list";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Campaigns" };

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
