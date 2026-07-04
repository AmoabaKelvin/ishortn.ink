import { notFound } from "next/navigation";

import { api } from "@/trpc/server";
import type { RouterOutputs } from "@/trpc/shared";

import { CampaignDetail } from "./_components/campaign-detail";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function CampaignDetailPage(props: Props) {
  const { slug } = await props.params;

  let campaign: RouterOutputs["campaign"]["getBySlug"];
  try {
    campaign = await api.campaign.getBySlug.query({ slug });
  } catch {
    notFound();
  }

  const sub = await api.subscriptions.get.query();

  return <CampaignDetail campaignId={campaign.id} initialData={campaign} plan={sub.plan} />;
}
