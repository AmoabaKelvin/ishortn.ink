import { api } from "@/trpc/server";

import { PaymentRedirect } from "./_components/payment-redirect";

import type { PaymentUpdateSource } from "@/lib/billing/entitlements";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Update payment method" };

export const dynamic = "force-dynamic";

const SOURCES: readonly PaymentUpdateSource[] = ["banner", "email"];

export default async function UpdatePaymentPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ source }, url] = await Promise.all([
    props.searchParams,
    api.lemonsqueezy.updatePaymentMethodUrl.query(),
  ]);

  return <PaymentRedirect url={url} source={SOURCES.find((value) => value === source) ?? null} />;
}
