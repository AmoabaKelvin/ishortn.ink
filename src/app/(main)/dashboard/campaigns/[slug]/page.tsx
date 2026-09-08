import { TRPCError } from "@trpc/server";
import { notFound } from "next/navigation";

import { api } from "@/trpc/server";

import { CampaignDetail } from "./_components/campaign-detail";

import type { RouterOutputs } from "@/trpc/shared";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function CampaignDetailPage(props: Props) {
  const { slug } = await props.params;

  let campaign: RouterOutputs["campaign"]["getBySlug"];
  try {
    campaign = await api.campaign.getBySlug.query({ slug });
  } catch (error) {
    // Only a real NOT_FOUND becomes a 404 — auth/server errors must surface,
    // not masquerade as a missing campaign.
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const sub = await api.subscriptions.get.query();

  return <CampaignDetail campaignId={campaign.id} initialData={campaign} plan={sub.plan} />;
}
