import { notFound } from "next/navigation";
import { z } from "zod";

import { api } from "@/trpc/server";

import { BioPageBuilder } from "./_components/bio-page-builder";

import type { RouterOutputs } from "@/trpc/shared";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Bio Page" };

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// `?tab=analytics` deep-links to a tab; anything else opens the editor.
const tabSchema = z.enum(["content", "design", "analytics", "subscribers"]).catch("content");

export default async function BioPageBuilderPage(props: Props) {
  const [{ id: idParam }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  let page: RouterOutputs["bioPage"]["get"];
  try {
    page = await api.bioPage.get.query({ id });
  } catch {
    notFound();
  }

  const sub = await api.subscriptions.get.query();

  return (
    <BioPageBuilder
      pageId={id}
      initialData={page}
      plan={sub.plan}
      initialTab={tabSchema.parse(searchParams.tab)}
    />
  );
}
