import { redirect } from "next/navigation";

import { env } from "@/env.mjs";
import { getPaddleConfig } from "@/lib/paddle/config";

import { PaddleCheckout } from "./_components/paddle-checkout";
import { parseTransactionId } from "./_components/transaction-id";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Checkout" };

// The client token is a runtime secret; it must be read per request, not inlined at build.
export const dynamic = "force-dynamic";

// Paddle's default payment link: server-created transactions (new checkouts and payment-method
// updates, including links in Paddle's own emails) open here with `?_ptxn=txn_…`.
export default async function CheckoutPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { _ptxn } = await props.searchParams;
  const config = getPaddleConfig();
  const transactionId = parseTransactionId(_ptxn);
  if (!config || !transactionId) redirect("/dashboard/pricing");

  return (
    <PaddleCheckout
      environment={config.environment}
      clientToken={config.clientToken}
      transactionId={transactionId}
      successUrl={`${env.NEXT_PUBLIC_APP_URL}/dashboard/settings?checkout=success#billing`}
    />
  );
}
