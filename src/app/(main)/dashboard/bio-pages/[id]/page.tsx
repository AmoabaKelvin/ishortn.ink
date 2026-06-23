import { notFound } from "next/navigation";

import { api } from "@/trpc/server";
import type { RouterOutputs } from "@/trpc/shared";

import { BioPageBuilder } from "./_components/bio-page-builder";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function BioPageBuilderPage(props: Props) {
  const { id: idParam } = await props.params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  let page: RouterOutputs["bioPage"]["get"];
  try {
    page = await api.bioPage.get.query({ id });
  } catch {
    notFound();
  }

  const sub = await api.subscriptions.get.query();

  return <BioPageBuilder pageId={id} initialData={page} plan={sub.plan} />;
}
